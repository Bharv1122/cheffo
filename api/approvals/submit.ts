// POST /api/approvals/submit — the vet submits their decision.
//
// Body: { token, decision, notes, vetName, vetPractice, vetState, signatureConfirmed }
// Public (no Authorization header) — the token IS the auth.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { hashToken } from '../_lib/approvalToken';
import { checkIpRateLimit, tooManyRequestsResponse } from '../_lib/rateLimit';
import { validateIngredients } from '../../src/utils/safetyValidator';
import {
  gramsToCups,
  gramsPerCupFor,
  cupsToMl,
  gramsToOz,
  groceryLabel,
  formatMetricIngredient,
  formatVolumeIngredient,
} from '../../src/utils/calculator';
import { getIngredientById } from '../../src/data/ingredients';
import type { ApprovalStatus, Json } from '../../src/types/database';
import type { DogProfile } from '../../src/types/dog';
import type { Recipe, RecipeIngredient, IngredientCategory, ShoppingListItem } from '../../src/types/recipe';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

interface SupplementDoseInput {
  supplementName?: unknown;
  doseText?: unknown;
}

interface SupplementDoseClean {
  supplementName: string;
  doseText: string;
}

interface IngredientEditInput {
  ingredientId?: unknown;
  name?: unknown;
  amountGrams?: unknown;
  category?: unknown;
  prepNote?: unknown;
}

interface SubmitBody {
  token?: string;
  decision?: 'approve' | 'approve_with_notes' | 'decline';
  notes?: string;
  vetName?: string;
  vetPractice?: string;
  vetState?: string;
  signatureConfirmed?: boolean;
  supplementDoses?: SupplementDoseInput[];
  ingredientEdits?: IngredientEditInput[];
}

const VALID_CATEGORIES: ReadonlyArray<IngredientCategory> = ['protein', 'carb', 'vegetable', 'fat', 'supplement', 'treat'];
const MAX_INGREDIENT_EDITS = 25;
const MAX_INGREDIENT_NAME_CHARS = 80;
const MIN_AMOUNT_GRAMS = 1;
const MAX_AMOUNT_GRAMS = 5000;
const DEFAULT_CAL_PER_GRAM_FOR_UNKNOWN = 1.5;

function mapIngredientCategoryToShopping(category: IngredientCategory): ShoppingListItem['category'] {
  switch (category) {
    case 'protein': return 'protein';
    case 'vegetable': return 'produce';
    case 'supplement': return 'supplement';
    case 'carb':
    case 'fat':
    case 'treat':
    default: return 'pantry';
  }
}

interface NormalizedIngredientEdit {
  ingredientId: string;
  name: string;
  amountGrams: number;
  category: IngredientCategory;
  prepNote?: string;
  isCustom: boolean; // true when from "Other..." (no catalog hit)
}

// Validate + normalize the vet's ingredient edits. Returns the cleaned list or
// an error string the caller can pass back to the form. (CHE-126)
function normalizeIngredientEdits(input: unknown): { edits?: NormalizedIngredientEdit[]; error?: string } {
  if (!Array.isArray(input)) return { error: 'ingredientEdits must be an array' };
  if (input.length === 0) return { error: 'At least one ingredient is required' };
  if (input.length > MAX_INGREDIENT_EDITS) {
    return { error: `Too many ingredient edits (max ${MAX_INGREDIENT_EDITS})` };
  }

  const cleaned: NormalizedIngredientEdit[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as IngredientEditInput;
    const rawCatalogId = typeof e.ingredientId === 'string' ? e.ingredientId.trim() : '';
    const rawName = typeof e.name === 'string' ? e.name.trim().slice(0, MAX_INGREDIENT_NAME_CHARS) : '';
    const rawAmount = typeof e.amountGrams === 'number' && Number.isFinite(e.amountGrams)
      ? Math.round(e.amountGrams)
      : NaN;
    const rawCategory = typeof e.category === 'string' ? e.category : '';
    const rawPrep = typeof e.prepNote === 'string' ? e.prepNote.trim().slice(0, 120) : '';

    if (!Number.isFinite(rawAmount) || rawAmount < MIN_AMOUNT_GRAMS || rawAmount > MAX_AMOUNT_GRAMS) {
      return { error: `Each ingredient amount must be between ${MIN_AMOUNT_GRAMS} and ${MAX_AMOUNT_GRAMS} g` };
    }

    const catalog = rawCatalogId ? getIngredientById(rawCatalogId) : undefined;
    if (catalog) {
      cleaned.push({
        ingredientId: catalog.id,
        name: catalog.name,
        category: catalog.category as IngredientCategory,
        amountGrams: rawAmount,
        prepNote: rawPrep || (catalog.prepNotes ?? undefined),
        isCustom: false,
      });
      continue;
    }
    // "Other..." — vet wrote their own. Must have a non-empty name.
    if (!rawName) return { error: 'Custom ingredients need a name' };
    const category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as IngredientCategory)
      : 'protein';
    cleaned.push({
      ingredientId: `custom-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      name: rawName,
      category,
      amountGrams: rawAmount,
      prepNote: rawPrep || undefined,
      isCustom: true,
    });
  }
  if (cleaned.length === 0) return { error: 'No valid ingredients in the edit list' };
  return { edits: cleaned };
}

const MAX_NOTES_CHARS = 500;
const MAX_DOSE_TEXT_CHARS = 200;
const MAX_DOSE_ENTRIES = 20;

// Filter the vet's supplement-dose entries to a safe, normalized list. Drops
// entries with no name or no text (vet left it blank), trims, and caps each
// field's length. Returns null when nothing usable was sent. (CHE-116)
function normalizeSupplementDoses(input: unknown): SupplementDoseClean[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned: SupplementDoseClean[] = [];
  for (const entry of input.slice(0, MAX_DOSE_ENTRIES)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as SupplementDoseInput;
    const name = typeof e.supplementName === 'string' ? e.supplementName.trim() : '';
    const dose = typeof e.doseText === 'string' ? e.doseText.trim().slice(0, MAX_DOSE_TEXT_CHARS) : '';
    if (!name || !dose) continue;
    cleaned.push({ supplementName: name, doseText: dose });
  }
  return cleaned.length > 0 ? cleaned : null;
}

// Tell the recipe's owner that the vet finished their review. Same Resend
// account/domain that the request-side email uses. Best-effort — a delivery
// failure must not roll back the approval, just log it. (CHE-124)
async function sendUserNotificationEmail(args: {
  userEmail: string;
  recipeName: string;
  dogName: string;
  vetName: string;
  status: ApprovalStatus;
  notes: string | null;
  supplementDoses: SupplementDoseClean[] | null;
  recipeUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? 'Cheffo <vet-approvals@cheffodoggo.com>';
  if (!apiKey) {
    console.warn(`[approvals] RESEND_API_KEY missing — skipping user notify for ${args.userEmail}`);
    return;
  }

  let subject: string;
  let intro: string;
  if (args.status === 'approved') {
    subject = `Dr. ${args.vetName} approved your ${args.recipeName} recipe`;
    intro = `Great news — Dr. ${args.vetName} just approved your "${args.recipeName}" recipe for ${args.dogName}.`;
  } else if (args.status === 'approved_with_notes') {
    subject = `Dr. ${args.vetName} approved your ${args.recipeName} (with notes)`;
    intro = `Dr. ${args.vetName} approved your "${args.recipeName}" recipe for ${args.dogName} with a few notes to consider.`;
  } else {
    subject = `Dr. ${args.vetName} reviewed your ${args.recipeName} recipe`;
    intro = `Dr. ${args.vetName} reviewed your "${args.recipeName}" recipe for ${args.dogName} and doesn't recommend it as-is. Their reasoning is below.`;
  }

  const lines: string[] = [`Hi,`, ``, intro, ``];
  if (args.notes) {
    lines.push(`Their notes:`, `"${args.notes}"`, ``);
  }
  if (args.supplementDoses && args.supplementDoses.length > 0) {
    lines.push(`Recommended supplement doses:`);
    for (const dose of args.supplementDoses) {
      lines.push(`  • ${dose.supplementName}: ${dose.doseText}`);
    }
    lines.push(``);
  }
  lines.push(`Open the recipe in Cheffo:`, args.recipeUrl, ``, `— Cheffo`);
  const text = lines.join('\n');

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromAddress, to: [args.userEmail], subject, text }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error(`[approvals] User notify failed (${upstream.status}): ${errText}`);
    }
  } catch (sendError) {
    console.error('[approvals] User notify threw:', sendError);
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function decisionToStatus(decision: SubmitBody['decision']): ApprovalStatus | null {
  switch (decision) {
    case 'approve':
      return 'approved';
    case 'approve_with_notes':
      return 'approved_with_notes';
    case 'decline':
      return 'declined';
    default:
      return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const rateLimit = await checkIpRateLimit(req, 'approvals_submit');
  if (!rateLimit.allowed) return tooManyRequestsResponse(rateLimit);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const token = body.token?.trim();
  if (!token) return jsonResponse(400, { error: 'token is required' });

  const status = decisionToStatus(body.decision);
  if (!status) return jsonResponse(400, { error: 'decision must be approve | approve_with_notes | decline' });

  const vetName = body.vetName?.trim();
  if (!vetName) return jsonResponse(400, { error: 'vetName is required' });
  if (!body.signatureConfirmed) {
    return jsonResponse(400, { error: 'You must confirm the e-signature checkbox to submit' });
  }
  const notes = body.notes?.slice(0, MAX_NOTES_CHARS) ?? null;
  // status is the mapped ApprovalStatus ('approved_with_notes'), NOT the raw
  // decision ('approve_with_notes') — the old comparison never matched, so this
  // required-notes guard silently never fired.
  if (status === 'approved_with_notes' && !notes) {
    return jsonResponse(400, { error: 'Notes are required when approving with notes' });
  }

  // Vet's per-supplement doses are only meaningful on approvals — skip them on
  // declines (the vet isn't recommending the recipe, so a dose is moot).
  const supplementDoses = status === 'declined' ? null : normalizeSupplementDoses(body.supplementDoses);

  const tokenHashHex = await hashToken(token);
  const admin = getSupabaseAdmin();
  const { data: approval, error: lookupError } = await admin
    .from('approvals')
    .select('*')
    .eq('token_hash', tokenHashHex)
    .single();
  if (lookupError || !approval) return jsonResponse(404, { error: 'Approval link not found' });

  if (approval.status !== 'pending') {
    return jsonResponse(409, { error: 'This approval has already been submitted' });
  }
  if (new Date(approval.token_expires_at).getTime() < Date.now()) {
    return jsonResponse(410, { error: 'This approval link has expired' });
  }

  // Apply vet's ingredient edits if any (CHE-126). Skip for declines — the
  // recipe isn't being adopted. Safety check uses the dog's profile;
  // failures return 400 so the form can show the reason without marking the
  // approval. Recipe is updated AFTER the approval row update succeeds.
  let recipeUpdatedByVet = false;
  let savedRecipeUpdate: { newRecipeData: Recipe } | null = null;
  let cachedDog: { name: string } | null = null;

  if (status !== 'declined' && Array.isArray(body.ingredientEdits) && body.ingredientEdits.length > 0) {
    const { edits, error: editError } = normalizeIngredientEdits(body.ingredientEdits);
    if (editError || !edits) return jsonResponse(400, { error: editError ?? 'Invalid ingredient edits' });

    const { data: dogRow, error: dogError } = await admin
      .from('dog_profiles')
      .select('name, allergies, avoid_foods, medications, life_stage')
      .eq('id', approval.dog_profile_id)
      .single();
    if (dogError || !dogRow) {
      return jsonResponse(500, { error: 'Could not load the dog profile for safety check' });
    }
    cachedDog = { name: dogRow.name };

    const dogShim: Partial<DogProfile> = {
      name: dogRow.name,
      allergies: dogRow.allergies ?? [],
      avoidFoods: dogRow.avoid_foods ?? [],
      medications: dogRow.medications ?? [],
      lifeStage: dogRow.life_stage,
    };
    const safety = validateIngredients(edits.map((e) => e.name), dogShim as DogProfile);
    if (!safety.safe) {
      return jsonResponse(400, {
        error: `Safety check failed: ${safety.errors.join(' ')}`,
        safetyErrors: safety.errors,
      });
    }

    const { data: recipeRow, error: recipeFetchError } = await admin
      .from('saved_recipes')
      .select('*')
      .eq('id', approval.recipe_id)
      .single();
    if (recipeFetchError || !recipeRow) {
      return jsonResponse(500, { error: 'Could not load the saved recipe' });
    }
    const currentRecipe = recipeRow.recipe_data as unknown as Recipe;

    const newIngredients: RecipeIngredient[] = edits.map((edit) => {
      // Populate the same density-aware display fields the generator produces,
      // so vet-edited recipes don't lose their volume/units (previously these
      // were left undefined, making US-volume fall back to water density).
      const amountCups = edit.category === 'supplement'
        ? undefined
        : gramsToCups(edit.amountGrams, gramsPerCupFor(edit.ingredientId));
      const amountMl = amountCups ? cupsToMl(amountCups) : Math.max(1, Math.round(edit.amountGrams));
      const displayBase = {
        name: edit.name,
        category: edit.category,
        amountGrams: edit.amountGrams,
        amountCups,
        amountMl,
      };
      return {
        ingredientId: edit.ingredientId,
        name: edit.name,
        category: edit.category,
        amountGrams: edit.amountGrams,
        amountCups,
        amountMl,
        amountOz: gramsToOz(edit.amountGrams),
        groceryFriendlyAmount: groceryLabel(edit.amountGrams, edit.name),
        displayMetric: formatMetricIngredient(displayBase),
        displayVolume: formatVolumeIngredient(displayBase),
        prepNote: edit.prepNote,
      };
    });

    // Recompute nutrition — catalog ingredients use their known caloriesPerGram;
    // "Other..." items use a 1.5 kcal/g default (rough average for mixed
    // homemade ingredients). Resulting numbers are clearly estimates.
    let totalCal = 0;
    for (const ing of newIngredients) {
      const catalog = getIngredientById(ing.ingredientId);
      const calPerGram = catalog?.caloriesPerGram ?? DEFAULT_CAL_PER_GRAM_FOR_UNKNOWN;
      totalCal += ing.amountGrams * calPerGram;
    }
    const mealsPerDay = Math.max(1, currentRecipe.serving?.mealsPerDay ?? 2);
    const totalDailyGrams = newIngredients.reduce((sum, ing) => sum + ing.amountGrams, 0);

    const newRecipeData: Recipe = {
      ...currentRecipe,
      ingredients: newIngredients,
      nutrition: {
        caloriesPerServing: Math.round(totalCal / mealsPerDay),
        caloriesPerDay: Math.round(totalCal),
        isEstimate: true,
      },
      serving: {
        ...currentRecipe.serving,
        mealsPerDay,
        totalDailyGrams,
        gramsPerMeal: Math.round(totalDailyGrams / mealsPerDay),
        cupsPerMeal: Math.round((totalDailyGrams / mealsPerDay / 240) * 10) / 10,
      },
      shoppingList: [
        ...newIngredients.map((ing) => ({
          name: ing.name,
          displayAmount: ing.displayVolume ?? ing.groceryFriendlyAmount ?? `${ing.amountGrams} g`,
          displayAmountMetric: ing.displayMetric,
          displayAmountVolume: ing.displayVolume,
          category: mapIngredientCategoryToShopping(ing.category),
          note: ing.prepNote,
        })),
        ...currentRecipe.shoppingList.filter((item) => item.category === 'equipment'),
      ],
      updatedAt: new Date().toISOString(),
    };
    savedRecipeUpdate = { newRecipeData };
    recipeUpdatedByVet = true;
  }

  const { error: updateError } = await admin
    .from('approvals')
    .update({
      status,
      notes,
      vet_name: vetName,
      vet_practice: body.vetPractice?.trim() ?? null,
      vet_state: body.vetState?.trim() ?? null,
      vet_signature_confirmed: true,
      supplement_doses: supplementDoses as unknown as Json | null,
      recipe_updated_by_vet: recipeUpdatedByVet,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', approval.id);
  if (updateError) return jsonResponse(500, { error: updateError.message });

  // Apply the recipe update AFTER the approval row succeeded. If this fails,
  // the approval still stands (the recipe is just unchanged) — log only.
  if (savedRecipeUpdate) {
    const { error: updateRecipeError } = await admin
      .from('saved_recipes')
      .update({
        recipe_data: savedRecipeUpdate.newRecipeData as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', approval.recipe_id);
    if (updateRecipeError) {
      console.error('[approvals] Saved recipe update failed (non-fatal):', updateRecipeError.message);
    }
  }

  // Best-effort notification email to the recipe's owner — fire-and-forget so
  // a Resend hiccup can't block the vet's submit response. (CHE-124)
  try {
    const recipeSnapshot = (approval.recipe_snapshot ?? {}) as { name?: string };
    const recipeName = (typeof recipeSnapshot.name === 'string' && recipeSnapshot.name) || 'Your recipe';
    const url = new URL(req.url);
    const origin = process.env.PUBLIC_APP_ORIGIN ?? `${url.protocol}//${url.host}`;
    const recipeUrl = `${origin}/recipes/${approval.recipe_id}`;

    // Reuse the dog profile already loaded for the safety check when present
    // to avoid a duplicate query on the edit path.
    const [{ data: userLookup }, dogName] = await Promise.all([
      admin.auth.admin.getUserById(approval.user_id),
      cachedDog
        ? Promise.resolve(cachedDog.name)
        : admin
            .from('dog_profiles')
            .select('name')
            .eq('id', approval.dog_profile_id)
            .single()
            .then((r) => r.data?.name ?? null),
    ]);
    const userEmail = userLookup?.user?.email;
    if (userEmail) {
      await sendUserNotificationEmail({
        userEmail,
        recipeName,
        dogName: dogName ?? 'your dog',
        vetName,
        status,
        notes,
        supplementDoses,
        recipeUrl,
      });
    } else {
      console.warn(`[approvals] No user email found for user_id ${approval.user_id} — skipping notify`);
    }
  } catch (notifyError) {
    console.error('[approvals] Notify pipeline failed (non-fatal):', notifyError);
  }

  return jsonResponse(200, { status });
}
