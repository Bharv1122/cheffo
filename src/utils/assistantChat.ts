import type { DogProfile } from '../types/dog';
import type { ChatMessage, ParsedChatRecipe } from '../types/assistant';
import { getFallbackAssistantResponse } from '../data/assistantResponses';

const API_KEY = import.meta.env.VITE_LLM_API_KEY;
const MODEL = import.meta.env.VITE_LLM_TEXT_MODEL ?? 'gpt-4o-mini';
const BASE_URL = import.meta.env.VITE_LLM_BASE_URL ?? 'https://routellm.abacus.ai/v1';
// Trim long histories to control token usage. Keep the most recent N turns.
const MAX_HISTORY_MESSAGES = 16;

const SYSTEM_PROMPT = `You are Chef Doggo, an expert canine nutrition assistant trusted by owners cooking fresh, homemade meals for their dogs. You combine three areas of expertise:

1. **Veterinary nutrition** — AAFCO requirements, macro and micronutrient balance, calorie calculations, and how needs change with life stage (puppy/adult/senior), activity level, and health conditions (kidney disease, pancreatitis, diabetes, allergies, etc.).
2. **Practical homemade dog-food cooking** — give specific, hands-on preparation steps. When asked about ingredients, name the method (steam, boil, bake, pan-cook), the time, the heat level, the safe internal temperature, the cut size, and how to portion and store.
3. **Canine supplements** — calcium sources (eggshell powder, calcium carbonate), omega-3s (fish/krill oil dosing by body weight), multivitamins, probiotics, joint support (glucosamine/chondroitin), when to add them (after cooling, since heat degrades many actives), and known food/medication interactions.

**Be specific and concrete.** Don't give vague answers when a specific one exists.
- ❌ "Vegetables can be prepared in several ways."
- ✅ "Steam carrots for 8–10 minutes over simmering water until fork-tender, then dice to ½-inch for small dogs or 1-inch for large dogs. Cooked vegetables digest better than raw."

**Safety rules (non-negotiable):**
- Never recommend toxic-to-dogs foods: xylitol, chocolate, grapes, raisins, onions, garlic (including powders), macadamia nuts, alcohol, caffeine, avocado, raw yeast dough, nutmeg.
- If the user describes acute symptoms (vomiting blood, seizures, collapse, suspected toxin ingestion), tell them to **call their veterinarian or the ASPCA Animal Poison Control Center (888-426-4435) immediately**, not to wait.
- For dogs on medication, flag known food/supplement interactions (e.g., warfarin + fish oil = bleeding risk; digoxin + hawthorn = altered drug levels). If you're not sure, say so and recommend confirming with their vet.
- Always note that homemade diets need supplementation to be nutritionally complete over the long term.

**Style:**
- Friendly but expert — like a vet who genuinely wants to help.
- Use Markdown (lists, numbered steps, bold) when it improves clarity. Keep responses focused — usually under ~250 words unless the question requires depth.
- Personalize using the dog profile when one is provided (name, breed, weight, conditions, allergies, medications).
- If you're genuinely uncertain, say so — but offer the closest accurate answer you can.

**When giving a complete recipe:** structure it clearly with an "Ingredients" section (each item on its own line with an amount) and a numbered "Instructions" or "Steps" section. Keep ingredient amounts as one day's worth of food for a typical 30-pound adult dog — the app will scale to the user's actual dog automatically.`;

// Tight, single-purpose prompt for the second-pass recipe extraction call.
// Returns ONLY a JSON object — no preamble, no markdown.
const EXTRACT_RECIPE_PROMPT = `You convert a homemade dog-food recipe (written in natural language) into structured JSON. Output ONLY valid JSON — no markdown, no commentary.

Schema:
{
  "name": string,                // concise recipe name, max 60 chars
  "description": string,         // 1–2 sentence summary
  "type": "full_meal" | "batch_week" | "topper" | "treat" | "pantry",
  "ingredients": [
    { "name": string, "grams": number, "prepNote"?: string }
  ],
  "instructions": [ string ]     // step text, in order
}

Rules:
- Pick the best \`type\` from context. If unclear, use "full_meal".
- \`grams\` is the absolute weight of each ingredient. Convert oz/lb/cups to grams using standard ratios (1 cup cooked rice ≈ 200g; 1 cup veg ≈ 100g; 1 oz ≈ 28g; 1 lb ≈ 454g).
- If the recipe is portioned for a week or batch, divide back down to ONE DAY of food for a typical 30-pound adult dog.
- Omit any ingredient you can't parse with a real gram amount. Never invent ingredients.
- Output ONLY the JSON object. No \`\`\` fences, no explanation.`;

interface OpenAIChatChoice {
  message?: { role?: string; content?: string };
  delta?: { role?: string; content?: string };
}

interface OpenAIChatResponse {
  choices?: OpenAIChatChoice[];
}

function buildDogContext(dog: DogProfile | null | undefined): string {
  if (!dog) return 'No dog profile is currently selected.';
  const lines: string[] = [`Name: ${dog.name}`];
  if (dog.breed) lines.push(`Breed: ${dog.breed}`);
  const ageBits: string[] = [];
  if (dog.ageYears) ageBits.push(`${dog.ageYears} yr`);
  if (dog.ageMonths) ageBits.push(`${dog.ageMonths} mo`);
  if (ageBits.length) lines.push(`Age: ${ageBits.join(' ')}`);
  lines.push(`Weight: ${dog.weightLbs} lbs${dog.idealWeightLbs ? ` (ideal: ${dog.idealWeightLbs} lbs)` : ''}`);
  lines.push(`Life stage: ${dog.lifeStage}`);
  lines.push(`Activity: ${dog.activityLevel.replace('_', ' ')}`);
  lines.push(`Meals per day: ${dog.mealsPerDay}`);
  if (dog.allergies?.length) lines.push(`Known allergies: ${dog.allergies.join(', ')}`);
  if (dog.avoidFoods?.length) lines.push(`Foods to avoid: ${dog.avoidFoods.join(', ')}`);
  if (dog.medications?.length) lines.push(`Current medications: ${dog.medications.join(', ')}`);
  if (dog.favoriteProteins?.length) lines.push(`Favorite proteins: ${dog.favoriteProteins.join(', ')}`);
  if (dog.texturePreference) lines.push(`Texture preference: ${dog.texturePreference.replace('_', ' ')}`);
  if (dog.pickyEater) lines.push('Note: picky eater');
  return `Dog profile:\n${lines.map(l => `- ${l}`).join('\n')}`;
}

function trimHistory(messages: readonly ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY_MESSAGES) return [...messages];
  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
}

function stripThoughtBlocks(text: string): string {
  // Remove complete <thought>…</thought> pairs.
  let cleaned = text.replace(/<thought>[\s\S]*?<\/thought>\s*/g, '');
  // During streaming, the close tag may not have arrived yet. Hide anything
  // from an unmatched <thought> opener onward so it doesn't leak into the bubble.
  const openIdx = cleaned.indexOf('<thought>');
  if (openIdx !== -1) cleaned = cleaned.slice(0, openIdx);
  return cleaned.trim();
}

// Heuristic: does this assistant response describe a complete enough recipe to
// be worth offering a "Save to my recipes" action? We look for an Ingredients
// header with a few line items AND either an Instructions header or numbered
// cooking steps. This is loose on purpose — false positives just mean the user
// gets a Save button on something that won't extract well, which they can ignore.
export function looksLikeRecipe(text: string): boolean {
  const lower = text.toLowerCase();
  const hasIngredientsHeader = /\bingredients?\s*[:\n]/i.test(text);
  const hasInstructionsHeader = /\b(instructions?|steps|directions|preparation)\b\s*[:\n]/i.test(text);
  const numberedSteps = (text.match(/^\s*\d+[.)]\s+\S/gm) ?? []).length;
  const bulletLines = (text.match(/^\s*[-*•]\s+\S/gm) ?? []).length;
  if (!hasIngredientsHeader) return false;
  // Require some structure under the ingredients header — either an
  // instructions section or a few bullets/steps.
  if (hasInstructionsHeader) return bulletLines + numberedSteps >= 2;
  return numberedSteps >= 2 && bulletLines >= 2;
}

function tryParseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Strip optional ```json fences a model sometimes adds despite instructions.
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Fallback: find the first {...} object in the text.
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      return null;
    }
  }
}

const VALID_RECIPE_TYPES: ReadonlyArray<ParsedChatRecipe['type']> = [
  'full_meal',
  'batch_week',
  'topper',
  'treat',
  'pantry',
];

// Pull a gram count out of whatever the model emitted: a number, a bare-number
// string ("200"), a grams string ("200g"), or another unit ("8 oz", "1 cup",
// "1.5 lb", "1 tbsp"). Returns null if we can't get a positive number out.
function coerceGrams(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const lower = value.toLowerCase();
  if (/\boz\b|ounce/.test(lower)) return Math.round(n * 28);
  if (/\blb\b|pound/.test(lower)) return Math.round(n * 454);
  if (/\bcup/.test(lower)) return Math.round(n * 200);
  if (/\btbsp|tablespoon/.test(lower)) return Math.round(n * 15);
  if (/\btsp|teaspoon/.test(lower)) return Math.round(n * 5);
  return Math.round(n); // assume grams when no unit is given
}

// Normalize whatever the extract LLM returned into our `ParsedChatRecipe`
// shape. More forgiving than a strict type-check: coerces string grams, accepts
// missing `description`, defaults `type`, and drops only the unparseable
// ingredient rows rather than failing the whole recipe.
function normalizeParsedRecipe(value: unknown): ParsedChatRecipe | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;

  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!name) return null;

  const description = typeof v.description === 'string' ? v.description.trim() : '';
  const rawType = typeof v.type === 'string' ? v.type.trim() : '';
  const type: ParsedChatRecipe['type'] =
    (VALID_RECIPE_TYPES as readonly string[]).includes(rawType)
      ? (rawType as ParsedChatRecipe['type'])
      : 'full_meal';

  if (!Array.isArray(v.ingredients)) return null;
  const ingredients = v.ingredients
    .map((entry): ParsedChatRecipe['ingredients'][number] | null => {
      if (!entry || typeof entry !== 'object') return null;
      const i = entry as Record<string, unknown>;
      const ingredientName = typeof i.name === 'string' ? i.name.trim() : '';
      if (!ingredientName) return null;
      const grams = coerceGrams(i.grams);
      if (!grams) return null;
      const prepNote = typeof i.prepNote === 'string' && i.prepNote.trim()
        ? i.prepNote.trim()
        : undefined;
      return { name: ingredientName, grams, prepNote };
    })
    .filter((entry): entry is ParsedChatRecipe['ingredients'][number] => entry !== null);
  if (ingredients.length === 0) return null;

  if (!Array.isArray(v.instructions)) return null;
  const instructions = v.instructions
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.trim());
  if (instructions.length === 0) return null;

  return { name, description, type, ingredients, instructions };
}

async function streamLlm(
  apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  onChunk: (visibleText: string) => void
): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: apiMessages,
      temperature: 0.4,
      max_tokens: 1800,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat completion failed (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Chat completion response had no body to stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let lastEmitted = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let lineEnd: number;
    while ((lineEnd = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const event = JSON.parse(payload) as OpenAIChatResponse;
        const delta = event.choices?.[0]?.delta?.content;
        if (!delta) continue;
        fullText += delta;
        const visible = stripThoughtBlocks(fullText);
        if (visible !== lastEmitted) {
          onChunk(visible);
          lastEmitted = visible;
        }
      } catch {
        // Ignore malformed SSE lines — some providers emit keep-alives.
      }
    }
  }

  return fullText;
}

export interface ChatRequest {
  history: readonly ChatMessage[];
  userMessage: string;
  dogProfile?: DogProfile | null;
  onChunk?: (visibleText: string) => void;
}

export interface ChatResponse {
  text: string;
  parsedRecipe: ParsedChatRecipe | null;
}

export async function chatWithAssistant({
  history,
  userMessage,
  dogProfile,
  onChunk,
}: ChatRequest): Promise<ChatResponse> {
  if (!API_KEY) {
    const text = await getFallbackAssistantResponse(userMessage, {
      dogName: dogProfile?.name,
      dogWeightLbs: dogProfile?.weightLbs,
    });
    onChunk?.(text);
    return { text, parsedRecipe: null };
  }

  const systemContent = `${SYSTEM_PROMPT}\n\n---\n\n${buildDogContext(dogProfile ?? null)}`;
  const trimmed = trimHistory(history);

  const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemContent },
    ...trimmed.map(m => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const fullText = await streamLlm(apiMessages, chunk => onChunk?.(chunk));
    const cleaned = stripThoughtBlocks(fullText);
    onChunk?.(cleaned);
    return { text: cleaned, parsedRecipe: null };
  } catch (error) {
    console.error('[assistantChat] LLM call failed, using fallback', error);
    const text = await getFallbackAssistantResponse(userMessage, {
      dogName: dogProfile?.name,
      dogWeightLbs: dogProfile?.weightLbs,
    });
    onChunk?.(text);
    return { text, parsedRecipe: null };
  }
}

// Second-pass extraction: takes an assistant message that looks like a recipe
// and asks the LLM to convert it to our structured JSON shape. Returns null if
// the model produced unparseable output or there's no API key configured.
export async function extractRecipeFromText(recipeText: string): Promise<ParsedChatRecipe | null> {
  if (!API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: EXTRACT_RECIPE_PROMPT },
          { role: 'user', content: recipeText },
        ],
        temperature: 0,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      console.warn('[assistantChat] extract call failed', response.status, await response.text());
      return null;
    }
    const data = (await response.json()) as OpenAIChatResponse;
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.warn('[assistantChat] extract call returned empty content');
      return null;
    }
    const cleaned = stripThoughtBlocks(raw);
    const parsed = tryParseJsonObject(cleaned);
    const normalized = normalizeParsedRecipe(parsed);
    if (!normalized) {
      console.warn('[assistantChat] could not normalize parsed JSON; raw model output:', raw);
    }
    return normalized;
  } catch (error) {
    console.error('[assistantChat] recipe extraction failed', error);
    return null;
  }
}
