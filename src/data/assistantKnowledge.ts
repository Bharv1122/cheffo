// Knowledge base used by the rule-based fallback assistant. The LLM-backed
// chat in `utils/assistantChat.ts` is preferred when an API key is set; this
// module gives the fallback enough specific, vet-accurate content to be
// genuinely useful when no key is available.
//
// Sources: AAFCO adult-maintenance guidelines, AVMA general guidance,
// ASPCA Animal Poison Control toxic foods list, and the project's existing
// `data/ingredients.ts` and `data/toxicIngredients.ts`.

// ── Ingredient cooking methods ──────────────────────────────────────────────

export interface CookingMethod {
  method: 'steam' | 'boil' | 'bake' | 'pan-cook' | 'raw' | 'puree' | 'dehydrate';
  description: string;
  time: string;
  doneness: string;
  prep: string;
  serving: string;
  notes?: string;
}

export const INGREDIENT_COOKING: Record<string, CookingMethod[]> = {
  carrot: [
    {
      method: 'steam',
      description: 'Steaming carrots is the gentlest method — preserves the most nutrients (vitamin A, beta-carotene) and softens them enough for easy digestion.',
      time: '8–10 minutes over simmering water',
      doneness: 'Fork-tender — a fork should pierce them easily with light pressure',
      prep: 'Wash, peel if older or bitter, then slice into ¼-inch rounds (small dogs) or ½-inch chunks (large dogs)',
      serving: 'Cool completely before mixing into food. Most dogs digest cooked carrots better than raw.',
      notes: 'Raw carrots can be a low-cal chew for healthy adults, but seniors and small dogs do better with cooked.',
    },
    {
      method: 'boil',
      description: 'Boiling works too but loses some water-soluble nutrients to the water.',
      time: '6–8 minutes in salted-FREE water',
      doneness: 'Soft enough to mash gently with a fork',
      prep: 'Wash, peel, slice as above',
      serving: 'Drain, cool, mix in. Reserve the cooking water for moistening the meal if your dog likes it.',
    },
  ],
  'sweet potato': [
    {
      method: 'bake',
      description: 'Baking concentrates sweetness and creates a soft, mashable texture dogs love. The best method for sweet potato.',
      time: '45–60 minutes at 400°F (200°C)',
      doneness: 'Soft throughout when pierced; skin loose',
      prep: 'Wash, pierce skin in several places with a fork. Bake whole on a sheet pan.',
      serving: 'Let cool, remove skin (the skin is safe but harder to digest), then mash or cube.',
      notes: 'Excellent fiber and vitamin A source. Skip for dogs with calcium-oxalate bladder stones or kidney disease (high in oxalates).',
    },
    {
      method: 'boil',
      description: 'Faster than baking — good for batch cooking.',
      time: '15–20 minutes in unsalted water',
      doneness: 'Easily mashed with a fork',
      prep: 'Peel, dice into 1-inch cubes',
      serving: 'Drain and mash or cube. Cool fully before mixing.',
    },
  ],
  pumpkin: [
    {
      method: 'puree',
      description: 'Plain canned pumpkin puree (NOT pumpkin pie filling, which contains spices and sweeteners) is the easy default.',
      time: 'No cooking needed for canned pumpkin',
      doneness: 'Use plain canned 100% pumpkin straight from the can',
      prep: 'For fresh pumpkin: peel, deseed, cube, steam 15 min, then puree in a food processor.',
      serving: '1 tsp per 10 lbs body weight per day is a typical fiber-boost amount. Excess can cause loose stool.',
      notes: 'Pumpkin pie filling is dangerous — it has sugar, cinnamon, nutmeg, and sometimes xylitol. Always read the label.',
    },
  ],
  broccoli: [
    {
      method: 'steam',
      description: 'Broccoli is safe in small amounts but contains isothiocyanates that can irritate the gut at higher amounts — keep it under 10% of the meal.',
      time: '5–7 minutes over simmering water',
      doneness: 'Bright green and just-tender (not mushy)',
      prep: 'Cut into small florets, no thick stems (choking hazard)',
      serving: 'Cool, chop small for easy digestion.',
      notes: 'Avoid for dogs with thyroid issues (goitrogens). Skip the stalks.',
    },
  ],
  'green bean': [
    {
      method: 'steam',
      description: 'Green beans are one of the best dog-safe vegetables — low calorie, high fiber, nutrient-dense.',
      time: '5–6 minutes over simmering water',
      doneness: 'Bright green and tender-crisp',
      prep: 'Trim ends, leave whole or cut into 1-inch pieces',
      serving: 'Cool fully before mixing in.',
      notes: 'Plain frozen green beans are fine — just thaw and steam from frozen.',
    },
  ],
  spinach: [
    {
      method: 'steam',
      description: 'Spinach can be fed in small amounts but is high in oxalates — avoid for dogs with kidney disease or bladder stones.',
      time: '2–3 minutes; it wilts quickly',
      doneness: 'Just wilted and bright green',
      prep: 'Wash thoroughly, remove tough stems',
      serving: 'Roughly chop after cooking. Limit to a tablespoon or two per meal for medium dogs.',
      notes: 'Healthy alternative: kale (also goitrogenic, use sparingly) or romaine lettuce (no oxalate issue).',
    },
  ],
  zucchini: [
    {
      method: 'steam',
      description: 'Mild, low-calorie, easy to digest. Safe in larger amounts than most vegetables.',
      time: '4–5 minutes over simmering water',
      doneness: 'Tender but not mushy',
      prep: 'Wash, slice into ½-inch rounds or dice',
      serving: 'Cool and mix in.',
    },
  ],
  apple: [
    {
      method: 'raw',
      description: 'Apples are great fresh — fiber, vitamin C, low-cal. Just remove the core and seeds (seeds contain cyanide compounds in trace amounts).',
      time: 'No cooking',
      doneness: 'N/A',
      prep: 'Wash, core, deseed, slice or dice',
      serving: 'Small slices as a topper or treat. Avoid the core entirely — choking hazard plus seeds.',
    },
  ],
  blueberry: [
    {
      method: 'raw',
      description: 'Antioxidant-rich, low-calorie, dog-safe treat.',
      time: 'No cooking',
      doneness: 'N/A',
      prep: 'Wash thoroughly',
      serving: '1–5 berries per day for small dogs, up to 10–15 for large dogs. Excellent frozen as a treat.',
    },
  ],
  egg: [
    {
      method: 'pan-cook',
      description: 'Scrambled or hard-boiled — cook eggs fully. Raw egg whites contain avidin which binds biotin over time.',
      time: 'Scrambled: 3–4 min over medium-low; hard-boiled: 10 min in simmering water',
      doneness: 'Whites fully set, yolks cooked through (no runny yolk for dogs)',
      prep: 'No oil, no salt, no seasoning',
      serving: 'Cool to room temp before mixing in. Crushed eggshell (cleaned, baked, ground) is a great calcium source.',
      notes: 'Eggshell powder: bake clean shells at 250°F for 10 min, grind in coffee grinder. 1 tsp = ~1800 mg calcium.',
    },
  ],
  chicken: [
    {
      method: 'boil',
      description: 'Easiest, leanest cook for chicken — no added fat.',
      time: '15–20 minutes for boneless thighs/breasts, until 165°F internal',
      doneness: 'Internal temp 165°F (74°C). No pink in the center.',
      prep: 'Skinless, boneless. Trim visible fat for leaner cook (especially for pancreatitis-prone dogs).',
      serving: 'Cool completely, then shred or dice. Reserve some plain cooking water as broth (no salt, no onion/garlic).',
      notes: 'Never feed cooked chicken bones — they splinter. Raw bones are debated; not in scope here.',
    },
    {
      method: 'bake',
      description: 'Better flavor, still lean.',
      time: '20–25 min at 375°F (190°C)',
      doneness: '165°F internal',
      prep: 'Place on a foil-lined sheet, no oil/seasoning',
      serving: 'Cool, shred or dice.',
    },
  ],
  turkey: [
    {
      method: 'pan-cook',
      description: 'Ground turkey is the easiest format. Use 93% lean or leaner.',
      time: '6–8 minutes, breaking up as it cooks',
      doneness: 'Internal temp 165°F (74°C); no pink',
      prep: 'No oil; the rendered fat is plenty. Drain excess after cooking.',
      serving: 'Cool fully before mixing.',
      notes: 'Avoid pre-seasoned turkey (often contains onion/garlic). Plain ground only.',
    },
  ],
  beef: [
    {
      method: 'pan-cook',
      description: 'Ground beef should be 90% lean or leaner for most dogs; 85% is OK for active dogs but too fatty for pancreatitis-prone dogs.',
      time: '6–8 minutes, breaking up',
      doneness: 'Internal temp 160°F (71°C); no pink',
      prep: 'No oil, no seasoning. Drain rendered fat thoroughly.',
      serving: 'Cool to room temp before mixing.',
    },
  ],
  salmon: [
    {
      method: 'bake',
      description: 'Always cook salmon fully — raw or undercooked salmon (especially from the Pacific Northwest) can carry Neorickettsia helminthoeca, which causes "salmon poisoning" — fatal if untreated.',
      time: '12–15 minutes at 400°F (200°C) for a 1-inch-thick fillet',
      doneness: 'Internal temp 145°F (63°C); flesh flakes easily with a fork',
      prep: 'Skinless, boneless. Pin out any bones with tweezers.',
      serving: 'Cool, flake, mix in. Provides excellent omega-3.',
      notes: 'Canned salmon (plain, no salt) works as a shortcut.',
    },
  ],
  rice: [
    {
      method: 'boil',
      description: 'White rice is easiest to digest (great for upset stomachs); brown rice has more fiber and nutrients but is harder on sensitive guts.',
      time: 'White: 18 min; Brown: 40 min',
      doneness: 'Tender, fully absorbed water',
      prep: 'Rinse rice; cook in plain water (no salt, no broth with onion/garlic)',
      serving: 'Cool to room temp; refrigerate within an hour of cooking. Reheat to lukewarm before serving.',
      notes: '1 cup dry rice = ~3 cups cooked. Plan portion sizes accordingly.',
    },
  ],
  oat: [
    {
      method: 'boil',
      description: 'Plain rolled or steel-cut oats — never flavored or sweetened instant packets.',
      time: 'Rolled: 5 min; steel-cut: 20–25 min',
      doneness: 'Soft, creamy texture',
      prep: 'Use water, never milk (dogs are often lactose-intolerant). 1:3 oats-to-water ratio.',
      serving: 'Cool fully. Great for senior dogs or those with skin issues (beta-glucan).',
    },
  ],
};

// ── Ingredient safety lookup ────────────────────────────────────────────────

export interface IngredientSafetyRecord {
  name: string;
  aliases: string[];
  safety: 'safe' | 'limited' | 'unsafe' | 'toxic';
  why: string;
  guidance?: string;
}

export const INGREDIENT_SAFETY: IngredientSafetyRecord[] = [
  { name: 'chocolate', aliases: ['cocoa', 'cacao'], safety: 'toxic', why: 'Theobromine and caffeine are toxic to dogs; dose toxicity scales with chocolate type (darker = worse).', guidance: 'If ingested, call your vet or ASPCA Poison Control (888-426-4435) immediately. Have the chocolate type and amount ready.' },
  { name: 'grapes', aliases: ['raisin', 'currant', 'sultana'], safety: 'toxic', why: 'Cause acute kidney failure in dogs. Even a few grapes can be fatal in sensitive dogs — the toxic dose is unpredictable.', guidance: 'Any ingestion is a vet emergency. Induce vomiting only under vet direction.' },
  { name: 'onion', aliases: ['shallot', 'leek', 'chive', 'scallion', 'green onion'], safety: 'toxic', why: 'Contain N-propyl disulfide, which damages red blood cells and causes hemolytic anemia. Cumulative — repeated small doses are also dangerous.', guidance: 'Includes onion powder. Check any broth or seasoning blend before using.' },
  { name: 'garlic', aliases: ['garlic powder'], safety: 'toxic', why: 'Same hemolytic mechanism as onion, more concentrated. Even small amounts of garlic powder are unsafe.', guidance: 'Some holistic vets debate small fresh-garlic doses for flea support — Cheffo Doggo defaults to blocking entirely.' },
  { name: 'xylitol', aliases: ['birch sugar', 'wood sugar'], safety: 'toxic', why: 'Causes massive insulin release → hypoglycemia within 15–30 minutes; high doses → liver failure. Common in sugar-free peanut butter and gum.', guidance: 'Always check peanut butter and baked good labels. Any xylitol ingestion is an emergency.' },
  { name: 'macadamia nut', aliases: ['macadamia'], safety: 'toxic', why: 'Cause weakness, tremors, hyperthermia in dogs. Mechanism not fully understood.', guidance: 'Even small amounts can cause symptoms within 12 hours.' },
  { name: 'avocado', aliases: ['guacamole'], safety: 'unsafe', why: 'Contains persin; pit is a major choking and obstruction risk. Flesh in small amounts is usually OK, but not worth the risk.', guidance: 'Skip avocado entirely; safer alternatives exist for healthy fats.' },
  { name: 'alcohol', aliases: ['wine', 'beer', 'liquor', 'spirits'], safety: 'toxic', why: 'Dogs metabolize alcohol very differently — small amounts cause severe CNS depression.', guidance: 'Includes raw yeast dough (ferments in the stomach producing alcohol).' },
  { name: 'caffeine', aliases: ['coffee', 'tea', 'energy drink'], safety: 'toxic', why: 'Same family as theobromine; causes hyperactivity, tachycardia, seizures.', guidance: 'Includes coffee grounds (very concentrated) and tea bags.' },
  { name: 'nutmeg', aliases: [], safety: 'toxic', why: 'Contains myristicin — causes tremors, seizures, hallucinations in dogs.', guidance: 'Often hidden in pumpkin pie filling and baking blends. Always use plain pumpkin puree.' },
  { name: 'salt', aliases: ['sodium chloride'], safety: 'limited', why: 'Dogs get enough sodium from meat. Excess causes thirst, vomiting, and in extreme cases hypernatremia.', guidance: 'Never salt dog food. Avoid salted human foods, deli meat, broth (unless homemade unsalted), and pretzels.' },
  { name: 'dairy', aliases: ['milk', 'cheese', 'yogurt', 'butter', 'cream'], safety: 'limited', why: 'Many adult dogs are lactose-intolerant. Plain unsweetened Greek yogurt and small amounts of cheese are usually tolerated.', guidance: 'Start small to test tolerance. Skip if loose stool follows.' },
  { name: 'peanut butter', aliases: [], safety: 'safe', why: 'Plain, unsweetened, xylitol-free peanut butter is a great training treat and supplement carrier.', guidance: 'READ THE LABEL — many low-sugar brands now use xylitol. If "xylitol" or "birch sugar" appears, do not feed.' },
  { name: 'pumpkin', aliases: ['plain pumpkin', 'canned pumpkin'], safety: 'safe', why: 'Excellent fiber, low calorie, supports digestion (both diarrhea and constipation).', guidance: '1 tsp per 10 lbs body weight per day. Plain only — NEVER pumpkin pie filling.' },
  { name: 'banana', aliases: [], safety: 'safe', why: 'Safe in moderation; high in sugar so not for diabetic dogs.', guidance: 'A few slices as a treat. Frozen for a summer chew.' },
  { name: 'blueberry', aliases: ['blueberries'], safety: 'safe', why: 'Antioxidant-rich, low calorie, dog-safe.', guidance: 'Fresh or frozen as treats. Small dogs: 1–5 per day; large dogs: 10–15.' },
  { name: 'carrot', aliases: ['carrots'], safety: 'safe', why: 'Low calorie, high in beta-carotene. Excellent crunchy treat or meal addition.', guidance: 'Cooked digests better; raw makes a good low-cal chew.' },
  { name: 'sweet potato', aliases: ['yam'], safety: 'safe', why: 'High in fiber, vitamin A, B6. Great cooked.', guidance: 'Skip for dogs with kidney disease or calcium-oxalate bladder stones.' },
  { name: 'apple', aliases: [], safety: 'safe', why: 'Fiber and vitamin C. Core and seeds must be removed (seeds contain trace cyanide).', guidance: 'Slice and remove core completely.' },
  { name: 'fish oil', aliases: ['omega-3', 'salmon oil', 'krill oil'], safety: 'safe', why: 'Best non-controversial supplement for skin, coat, joint, and brain support.', guidance: 'Typical dose: 20 mg combined EPA+DHA per pound body weight per day. Add after cooking — heat degrades omegas.' },
];

export function lookupIngredientSafety(query: string): IngredientSafetyRecord | null {
  const q = query.toLowerCase().trim();
  for (const record of INGREDIENT_SAFETY) {
    if (q.includes(record.name)) return record;
    for (const alias of record.aliases) {
      if (q.includes(alias)) return record;
    }
  }
  return null;
}

export function lookupCookingMethods(query: string): { ingredient: string; methods: CookingMethod[] } | null {
  const q = query.toLowerCase().trim();
  for (const [ingredient, methods] of Object.entries(INGREDIENT_COOKING)) {
    if (q.includes(ingredient) || q.includes(ingredient + 's')) {
      return { ingredient, methods };
    }
  }
  return null;
}

// ── Supplements ─────────────────────────────────────────────────────────────

export interface SupplementInfo {
  name: string;
  aliases: string[];
  purpose: string;
  dose: string;
  timing: string;
  cautions?: string;
}

export const SUPPLEMENTS: SupplementInfo[] = [
  {
    name: 'calcium',
    aliases: ['calcium carbonate', 'eggshell powder', 'eggshell'],
    purpose: 'Non-negotiable for homemade diets — meat alone is calcium-poor and phosphorus-heavy, which throws off the Ca:P ratio (target 1.2:1 to 1.5:1).',
    dose: '~1000 mg elemental calcium per pound of meat used in the recipe (or 1 tsp eggshell powder ≈ 1800 mg calcium for ~2 lbs meat).',
    timing: 'Mix in after cooling. Distribute evenly across daily portions.',
    cautions: 'Skip extra calcium for dogs already on commercial complete-and-balanced food.',
  },
  {
    name: 'fish oil',
    aliases: ['omega-3', 'omega 3', 'salmon oil', 'krill oil', 'epa', 'dha'],
    purpose: 'Anti-inflammatory; supports skin, coat, joints, heart, brain. Especially valuable for allergic, arthritic, or senior dogs.',
    dose: '20 mg combined EPA+DHA per lb body weight per day. A typical 1000 mg fish oil softgel has ~300 mg combined EPA+DHA.',
    timing: 'Add after cooling — heat oxidizes omegas. Refrigerate the bottle after opening.',
    cautions: 'HARD BLOCK with blood thinners (warfarin, heparin). Reduce dose if on NSAIDs (rimadyl). Increased bleeding risk.',
  },
  {
    name: 'multivitamin',
    aliases: ['canine multi', 'multi vitamin'],
    purpose: 'Covers trace minerals (zinc, copper, manganese, iodine, selenium) and vitamins D, E, B-complex that are hard to get from whole food alone.',
    dose: 'Use a canine-specific product per label. Human multivitamins are usually overdosed on iron and unsafe.',
    timing: 'Mix in after cooling. Per-meal or once-daily depending on label.',
  },
  {
    name: 'probiotic',
    aliases: [],
    purpose: 'Supports gut microbiome — useful during diet transitions, after antibiotics, or for chronic loose stool.',
    dose: 'Canine-specific product per label. 1–5 billion CFU per serving is typical.',
    timing: 'Mix in cold or room-temp food. Heat kills the live cultures.',
  },
  {
    name: 'glucosamine',
    aliases: ['chondroitin', 'joint supplement'],
    purpose: 'Joint support for senior dogs, large breeds, or dogs with arthritis/dysplasia.',
    dose: 'Glucosamine: 20 mg/lb body weight daily. Chondroitin: 10–15 mg/lb daily. Often combined.',
    timing: 'With food, any time of day.',
  },
];

export function lookupSupplement(query: string): SupplementInfo | null {
  const q = query.toLowerCase().trim();
  for (const supplement of SUPPLEMENTS) {
    if (q.includes(supplement.name)) return supplement;
    for (const alias of supplement.aliases) {
      if (q.includes(alias)) return supplement;
    }
  }
  return null;
}

// ── Condition-specific dietary guidance ─────────────────────────────────────

export interface ConditionGuidance {
  name: string;
  aliases: string[];
  summary: string;
  doFeed: string[];
  avoid: string[];
  notes: string;
}

export const CONDITIONS: ConditionGuidance[] = [
  {
    name: 'kidney disease',
    aliases: ['ckd', 'renal', 'kidney failure'],
    summary: 'Goal: reduce phosphorus and protein quantity (not quality), reduce sodium, increase omega-3 and water content.',
    doFeed: ['Egg whites (high-quality, low-phosphorus protein)', 'White fish', 'White rice or pasta (carbs to spare protein)', 'Cooked, peeled cucumber and zucchini (high water)', 'Fish oil for kidney-protective omegas'],
    avoid: ['Organ meats (very high phosphorus)', 'Dairy and bones', 'High-protein raw diets', 'Spinach and sweet potato (high oxalate)', 'Salty foods'],
    notes: 'This is a medically supervised diet — work with your vet on phosphorus targets (often <0.5% on dry matter basis) and monitor BUN/creatinine.',
  },
  {
    name: 'pancreatitis',
    aliases: ['acute pancreatitis', 'pancreatic'],
    summary: 'Goal: low fat (under 10–15% on dry matter basis), highly digestible, frequent small meals.',
    doFeed: ['Skinless chicken breast (boiled)', 'White fish (cod, tilapia)', 'White rice', 'Plain pumpkin (small amounts)', 'Cooked egg whites'],
    avoid: ['Fatty meats (beef >85% lean, dark-meat chicken with skin)', 'Butter, oil, fish oil at typical doses', 'Ketogenic or high-fat diets — these can be fatal for pancreatitis-prone dogs', 'Cheese, peanut butter, fatty treats'],
    notes: 'During an acute attack: NPO (nothing by mouth) per vet, then bland chicken/rice for several days. Lifelong low-fat diet is typical after even one episode.',
  },
  {
    name: 'diabetes',
    aliases: ['diabetic'],
    summary: 'Goal: consistent portions and timing, complex carbs over simple, moderate fiber to slow glucose absorption.',
    doFeed: ['Lean protein (chicken, turkey, fish)', 'Complex carbs (brown rice, oats, sweet potato in moderation)', 'Green beans, broccoli (low-glycemic vegetables)', 'Moderate fiber'],
    avoid: ['Simple sugars (honey, fruit juice, sweet treats)', 'Semi-moist commercial foods (high in simple carbs)', 'Inconsistent meal timing'],
    notes: 'Feed at the same times each day, with insulin doses coordinated. Even minor diet changes need vet coordination.',
  },
  {
    name: 'allergies',
    aliases: ['food allergy', 'allergic', 'itching', 'skin issues'],
    summary: 'Goal: identify and eliminate triggers via a strict elimination diet (8–12 weeks of a single novel protein + single carb).',
    doFeed: ['Novel protein the dog has never eaten (rabbit, venison, duck, kangaroo)', 'Novel carb (quinoa, sweet potato, pea)', 'Omega-3 for skin support', 'Plain hydrolyzed-protein commercial diet during the elimination phase'],
    avoid: ['EVERY common allergen the dog has previously eaten — usually chicken, beef, dairy, wheat, soy, eggs', 'All treats, table scraps, flavored medications during the trial', 'Multiple protein sources during the trial'],
    notes: 'A true elimination diet requires 8–12 weeks of strict adherence. Working with a veterinary dermatologist or nutritionist increases success rate.',
  },
  {
    name: 'heart disease',
    aliases: ['cardiac', 'chf', 'heart failure', 'congestive heart'],
    summary: 'Goal: low sodium is the single most important change. Adequate taurine and L-carnitine for cardiac function.',
    doFeed: ['Unsalted lean protein', 'Heart muscle meat (taurine source)', 'Fresh water always available'],
    avoid: ['Salted broth or stock', 'Deli meat, cheese, processed foods', 'Most commercial treats (often high sodium)'],
    notes: 'Some breeds (Boxers, Cockers, Goldens, Dobermans) need extra taurine + L-carnitine even on commercial food. Coordinate with cardiologist.',
  },
];

export function lookupCondition(query: string): ConditionGuidance | null {
  const q = query.toLowerCase().trim();
  for (const condition of CONDITIONS) {
    if (q.includes(condition.name)) return condition;
    for (const alias of condition.aliases) {
      if (q.includes(alias)) return condition;
    }
  }
  return null;
}
