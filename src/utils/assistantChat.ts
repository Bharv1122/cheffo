import type { DogProfile } from '../types/dog';
import type { ChatMessage, ParsedChatRecipe } from '../types/assistant';
import { getFallbackAssistantResponse } from '../data/assistantResponses';

// The LLM key lives only in the server-side proxy (api/llm.ts). The client
// posts to the same-origin /api/llm endpoint — no key, no Authorization header.
const LLM_PROXY_URL = '/api/llm';
const MODEL = 'gemini-2.5-flash';
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

**When giving a complete recipe — REQUIRED format:**

1. Always include an "**Ingredients:**" section.
2. Every ingredient line MUST have a numeric quantity in grams. No exceptions. The owner can't cook a recipe with no amounts.
   - ✅ "* **Lean Ground Lamb** — 200 g"
   - ✅ "* **Sweet Potato** (peeled, cubed) — 120 g"
   - ❌ "* **Protein:** Lean Ground Lamb"   ← missing amount
   - ❌ "* Chicken (a generous handful)"   ← no number
3. Size the amounts to ONE DAY of food for a typical 30-pound adult dog (~350 g total per day). The app rescales to the actual dog's caloric needs automatically.
4. Follow with an "**Instructions:**" (or "Preparation Steps:" / "Directions:") section, numbered 1., 2., 3., …
5. Supplements, storage tips, vet notes are great — put them in clearly-labeled sections AFTER the ingredients/instructions (e.g. "**Supplements:**", "**Storage:**", "**Notes:**") so the app can tell them apart from cooking steps.

If the user only asked a question (portion sizes, ingredient safety, supplement advice), do NOT produce a recipe block — answer in prose.`;

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

// Heuristic fallback extractor: parses a recipe directly out of natural-
// language chat text using regex. Used when the LLM extract call returns
// nothing usable. Conservative on purpose — returns null unless it finds an
// Ingredients section with at least one parseable amount and a few steps.
const INGREDIENT_AMOUNT_RE = /(\d+(?:\.\d+)?(?:\/\d+)?|\d*\s*½|\d*\s*¼|\d*\s*¾)\s*(g(?:rams?)?|oz|ounces?|lb|lbs|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/i;

function fractionToNumber(value: string): number {
  if (value.includes('½')) return parseFloat(value.replace('½', '').trim() || '0') + 0.5;
  if (value.includes('¼')) return parseFloat(value.replace('¼', '').trim() || '0') + 0.25;
  if (value.includes('¾')) return parseFloat(value.replace('¾', '').trim() || '0') + 0.75;
  if (value.includes('/')) {
    const [num, den] = value.split('/').map(s => parseFloat(s.trim()));
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
  }
  return parseFloat(value);
}

function parseIngredientLine(raw: string): ParsedChatRecipe['ingredients'][number] | null {
  // Strip leading list markers (-, *, •, numbers) and bold/italic markdown
  const line = raw
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*_`]/g, '')
    .trim();
  if (!line) return null;

  const amountMatch = line.match(INGREDIENT_AMOUNT_RE);
  if (!amountMatch) return null;
  const qty = fractionToNumber(amountMatch[1]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = amountMatch[2].toLowerCase();
  const grams = coerceGrams(`${qty} ${unit}`);
  if (!grams) return null;

  // Strip the amount itself; whatever's left is the name (plus a prep note).
  const withoutAmount = line.slice(0, amountMatch.index) + line.slice(amountMatch.index! + amountMatch[0].length);

  // Pull a parenthetical ("(peeled, cubed)") out as a prep note instead of
  // mangling its contents into the ingredient name.
  const parenMatch = withoutAmount.match(/\(([^)]*)\)/);
  const prepNote = parenMatch?.[1].trim() || undefined;

  let rest = withoutAmount
    .replace(/\([^)]*\)/g, ' ')   // drop parenthetical groups, content and all
    .replace(/\s[—–-]+\s/g, ' ')  // drop "name — amount" style separators
    .replace(/[():,]+/g, ' ')     // tidy any stray brackets / punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (!rest) return null;

  // If the line has a "Name: amount …" pattern, the label before the colon was
  // likely the ingredient name; take it cleanly.
  const labelMatch = raw.match(/^\s*(?:[-*•]+\s*)?\*?\*?([^:*]+?)\*?\*?\s*:\s/);
  if (labelMatch && labelMatch[1].trim().length < 60) {
    rest = labelMatch[1].trim();
  }

  // Drop common preamble words leftover from things like "of chicken breast".
  rest = rest.replace(/^(?:of|the|a|an)\s+/i, '').trim();
  if (rest.length < 2) return null;

  return { name: rest, grams, prepNote };
}

// Looser section detector — matches headers like "**Ingredients:**",
// "## Ingredients", "🥩 Ingredients (one-day amounts):", "Instructions:" at the
// start of a line, regardless of trailing parenthetical or emoji prefix.
const SECTION_HEADER_LOOSE_RE = /^[\s>#*_•-]*[^\w]*\b(ingredients?|instructions?|directions?|steps?|preparation|method|supplements?|notes?|tips?|storage|nutrition|disclaimers?|safety|substitutions?|tools?|equipment|shopping)\b[\s:*_()\-—]*/i;
// Sections whose body should NOT be treated as ingredient lines.
const SKIP_SECTIONS = new Set(['supplements', 'supplement', 'notes', 'note', 'tips', 'tip', 'storage', 'nutrition', 'disclaimer', 'disclaimers', 'safety', 'tools', 'equipment', 'shopping']);

function classifyHeader(line: string): { name: string } | null {
  const m = line.match(SECTION_HEADER_LOOSE_RE);
  if (!m) return null;
  return { name: m[1].toLowerCase() };
}

export function heuristicExtractRecipe(text: string): ParsedChatRecipe | null {
  const lines = text.split(/\r?\n/);

  // Mark which section each line belongs to (or "" for pre-header content).
  // Lines under SKIP_SECTIONS are flagged so we don't pull supplements or
  // storage notes in as ingredients/steps.
  const sectionAtLine: string[] = new Array(lines.length).fill('');
  let current = '';
  for (let i = 0; i < lines.length; i++) {
    const header = classifyHeader(lines[i]);
    if (header) {
      current = header.name;
      sectionAtLine[i] = current;
    } else {
      sectionAtLine[i] = current;
    }
  }
  const isUsableLine = (i: number) => !SKIP_SECTIONS.has(sectionAtLine[i]);

  // Gather ingredients from every usable line that parses to an amount+name.
  // If the response has an explicit "Ingredients" section, parse only inside
  // it — otherwise pre-section prose like "rescale them for Cooper's 45 lbs…"
  // gets picked up as an ingredient because the line contains an amount+unit.
  // If no Ingredients header exists (models sometimes skip it), fall back to
  // parsing anywhere so we still catch headerless ingredient lists.
  const ingredientSectionNames = new Set(['ingredients', 'ingredient']);
  const hasIngredientsSection = sectionAtLine.some(s => ingredientSectionNames.has(s));
  const ingredients: ParsedChatRecipe['ingredients'] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isUsableLine(i)) continue;
    if (classifyHeader(lines[i])) continue; // skip the header line itself
    if (hasIngredientsSection && !ingredientSectionNames.has(sectionAtLine[i])) continue;
    const parsed = parseIngredientLine(lines[i]);
    if (parsed) ingredients.push(parsed);
  }
  if (ingredients.length < 2) {
    console.warn('[assistantChat] heuristic: only found', ingredients.length, 'ingredient(s). Source text:', text);
    return null;
  }

  // Gather instructions: prefer numbered lines under an Instructions-like
  // header, else any numbered/bulleted line in the document that isn't an
  // ingredient line and isn't in a skip section.
  const stepSectionNames = new Set(['instructions', 'instruction', 'directions', 'direction', 'steps', 'step', 'preparation', 'method']);
  const instructions: string[] = [];

  const hasStepSection = sectionAtLine.some(s => stepSectionNames.has(s));
  for (let i = 0; i < lines.length; i++) {
    if (!isUsableLine(i)) continue;
    if (hasStepSection && !stepSectionNames.has(sectionAtLine[i])) continue;
    const raw = lines[i].trim();
    if (!raw || classifyHeader(raw)) continue;
    const numbered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
    const bulleted = raw.match(/^\s*[-*•]\s+(.+)$/);
    const body = numbered ? numbered[1] : bulleted ? bulleted[1] : null;
    if (!body) continue;
    const stripped = body
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .trim();
    // Skip lines that already look like an ingredient (amount+unit at start).
    if (INGREDIENT_AMOUNT_RE.test(stripped) && stripped.length < 80) continue;
    if (stripped.length > 8) instructions.push(stripped);
  }
  if (instructions.length < 2) {
    console.warn('[assistantChat] heuristic: found', ingredients.length, 'ingredient(s) but only', instructions.length, 'step(s). Source text:', text);
    return null;
  }

  // Pull a plausible name out of the first heading or bolded title line.
  // Skip lines that match a section header (Ingredients / Instructions / etc.)
  // so the title doesn't end up as "Ingredients:" when the model goes
  // straight from an intro paragraph into the structured sections.
  let name = '';
  for (const line of lines) {
    if (classifyHeader(line)) continue;
    const heading = line.match(/^\s*#+\s+(.+)$/);
    if (heading) { name = heading[1].trim(); break; }
    const bolded = line.match(/^\s*\*\*([^*]+)\*\*\s*$/);
    if (bolded) { name = bolded[1].trim(); break; }
  }
  if (!name) name = 'Chef Doggo Recipe';
  name = name.replace(/[*_#]/g, '').trim().slice(0, 80);

  // Type guess: a 7-day batch text tends to mention "week", "batch", or "7 days".
  const lower = text.toLowerCase();
  const type: ParsedChatRecipe['type'] = /week|7\s*days?|batch/.test(lower)
    ? 'batch_week'
    : /topper/.test(lower)
    ? 'topper'
    : /treat/.test(lower)
    ? 'treat'
    : 'full_meal';

  return {
    name,
    description: `${name} — saved from a Chef Doggo chat suggestion.`,
    type,
    ingredients,
    instructions,
  };
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
  const response = await fetch(LLM_PROXY_URL, {
    method: 'POST',
    headers: {
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

  // The Vite dev server has no /api functions and answers /api/llm with the
  // SPA's index.html. Treat a non-streaming HTML reply as "proxy unavailable"
  // so the caller's canned fallback engages instead of an empty response.
  if ((response.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error('LLM proxy unavailable — run `vercel dev` for the live assistant');
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
// the model produced unparseable output or the request timed out.
const EXTRACT_TIMEOUT_MS = 30_000;
const EXTRACT_INPUT_MAX_CHARS = 4000;

export async function extractRecipeFromText(recipeText: string): Promise<ParsedChatRecipe | null> {
  // Cap input length so a runaway-long chat reply doesn't push the extract
  // call past the model's context or stall it for minutes.
  const trimmedInput = recipeText.length > EXTRACT_INPUT_MAX_CHARS
    ? `${recipeText.slice(0, EXTRACT_INPUT_MAX_CHARS)}\n…[truncated]`
    : recipeText;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

  try {
    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: EXTRACT_RECIPE_PROMPT },
          { role: 'user', content: trimmedInput },
        ],
        temperature: 0,
        // gemini-2.5-flash spends 400-800 invisible reasoning tokens that
        // count against max_tokens; with reasoning on, the 800-token cap was
        // routinely exhausted before any JSON was emitted (finish_reason
        // "length" -> truncated/empty output -> heuristic fallback). Extraction
        // is a mechanical transform that needs no reasoning, so disable it and
        // leave generous headroom for the JSON. (CHE-10)
        reasoning_effort: 'none',
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[assistantChat] extract call failed', response.status, await response.text());
      return heuristicExtractRecipe(recipeText);
    }
    const data = (await response.json()) as OpenAIChatResponse;
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      console.warn('[assistantChat] extract call returned empty content — falling back to regex');
      return heuristicExtractRecipe(recipeText);
    }
    const cleaned = stripThoughtBlocks(raw);
    const parsed = tryParseJsonObject(cleaned);
    const normalized = normalizeParsedRecipe(parsed);
    if (normalized) return normalized;
    console.warn('[assistantChat] could not normalize parsed JSON; falling back to regex. raw model output:', raw);
    return heuristicExtractRecipe(recipeText);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[assistantChat] recipe extraction timed out — falling back to regex');
    } else {
      console.error('[assistantChat] recipe extraction failed — falling back to regex', error);
    }
    return heuristicExtractRecipe(recipeText);
  } finally {
    clearTimeout(timeout);
  }
}
