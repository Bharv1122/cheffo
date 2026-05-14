import type { DogProfile } from '../types/dog';
import type { ChatMessage, ParsedChatRecipe } from '../types/assistant';
import { getFallbackAssistantResponse } from '../data/assistantResponses';

const API_KEY = import.meta.env.VITE_LLM_API_KEY;
const MODEL = import.meta.env.VITE_LLM_TEXT_MODEL ?? 'gpt-4o-mini';
const BASE_URL = import.meta.env.VITE_LLM_BASE_URL ?? 'https://routellm.abacus.ai/v1';
// Trim long histories to control token usage. Keep the most recent N turns.
const MAX_HISTORY_MESSAGES = 16;

const RECIPE_BLOCK_START = '```recipe-json';
const RECIPE_BLOCK_END = '```';

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

**Recipe output (when the user asks for a complete recipe):**
After your natural-language answer, append a JSON block in this exact format so the app can save it to the user's recipe list:

\`\`\`recipe-json
{
  "name": "Concise recipe name (max 60 chars)",
  "description": "1–2 sentence summary",
  "type": "full_meal",
  "ingredients": [
    {"name": "Chicken Breast", "grams": 200, "prepNote": "boneless, boiled and diced"},
    {"name": "White Rice", "grams": 100, "prepNote": "cooked"}
  ],
  "instructions": ["Step 1...", "Step 2...", "Step 3..."]
}
\`\`\`

- \`type\` must be one of: \`full_meal\`, \`batch_week\`, \`topper\`, \`treat\`, \`pantry\`.
- \`grams\` should be ONE DAY of food for a typical 30-pound adult dog. The app scales to the actual dog's needs automatically.
- Only emit this block when you're recommending an actual recipe — NOT for portion advice, ingredient questions, calculations, supplement guidance, or general tips. If it's not a recipe, do not include the block at all.`;

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
  return text.replace(/<thought>[\s\S]*?<\/thought>\s*/g, '').trim();
}

// Find a ```recipe-json fenced block in the text and parse it. Returns the
// parsed recipe (or null if none/invalid) and the cleaned text with the block
// removed so it doesn't render to the user.
function extractRecipeBlock(text: string): { cleanedText: string; parsedRecipe: ParsedChatRecipe | null } {
  const startIdx = text.indexOf(RECIPE_BLOCK_START);
  if (startIdx === -1) return { cleanedText: text, parsedRecipe: null };

  const afterStart = startIdx + RECIPE_BLOCK_START.length;
  const endIdx = text.indexOf(RECIPE_BLOCK_END, afterStart);
  if (endIdx === -1) {
    // Open fence, no close yet — strip the partial so the user doesn't see raw JSON.
    return { cleanedText: text.slice(0, startIdx).trimEnd(), parsedRecipe: null };
  }

  const jsonStr = text.slice(afterStart, endIdx).trim();
  const cleanedText = (text.slice(0, startIdx) + text.slice(endIdx + RECIPE_BLOCK_END.length)).trim();

  try {
    const parsed = JSON.parse(jsonStr) as ParsedChatRecipe;
    if (
      typeof parsed?.name === 'string' &&
      Array.isArray(parsed?.ingredients) &&
      parsed.ingredients.every(i => typeof i?.name === 'string' && typeof i?.grams === 'number') &&
      Array.isArray(parsed?.instructions) &&
      parsed.instructions.every(s => typeof s === 'string')
    ) {
      return { cleanedText, parsedRecipe: parsed };
    }
    return { cleanedText, parsedRecipe: null };
  } catch {
    return { cleanedText, parsedRecipe: null };
  }
}

// Compute the "safe to display" prefix of the full streamed text. We stop
// updating the visible content as soon as we see the recipe-json marker so the
// user never sees raw JSON appearing in the chat bubble.
function displayPrefix(fullText: string): string {
  const idx = fullText.indexOf(RECIPE_BLOCK_START);
  return idx === -1 ? fullText : fullText.slice(0, idx).trimEnd();
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
      max_tokens: 900,
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
        const visible = stripThoughtBlocks(displayPrefix(fullText));
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
    const { cleanedText, parsedRecipe } = extractRecipeBlock(cleaned);
    // Emit one final visible-text update so the chunk handler reflects the
    // fully-cleaned content (recipe block stripped if present).
    onChunk?.(cleanedText);
    return { text: cleanedText, parsedRecipe };
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
