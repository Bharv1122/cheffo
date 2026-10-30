export type ToxicCategory =
  | 'Food'
  | 'Fruit'
  | 'Vegetable'
  | 'Nut'
  | 'Drink'
  | 'Herb & spice'
  | 'Sweetener'
  | 'Additive'
  | 'Dairy & protein'
  | 'Physical hazard'
  | 'Other';

export interface ToxicEntry {
  name: string;
  aliases: string[];
  // hard_block: recipe generation stops completely
  // warning: shown prominently but does not block generation
  // info: reference only (the /safety page); the validator ignores it
  level: 'hard_block' | 'warning' | 'info';
  reason: string;
  category: ToxicCategory;
  // Display name on the /safety page when it differs from the matched name.
  title?: string;
  symptoms?: string[];
  onset?: string;
  // What an owner should do, in "ask your vet" terms.
  guidance?: string;
}

// Owner-facing wording for each level, used by the /safety page.
export const SAFETY_LEVEL_LABELS: Record<ToxicEntry['level'], string> = {
  hard_block: 'Toxic',
  warning: 'Caution',
  info: 'Safe in moderation',
};

export const ASPCA_POISON_CONTROL = '888-426-4435';

// Merged from Cheffo's original list and the older Chef Doggo safety database.
// Matching is word-bounded on name + aliases, so keep aliases specific: a
// broad alias (e.g. "soda", "mushrooms", "potato") would block safe recipes.
export const TOXIC_INGREDIENTS: ToxicEntry[] = [
  {
    name: 'chocolate',
    aliases: ['cocoa', 'cacao', 'dark chocolate', 'milk chocolate', 'white chocolate', 'chocolate chips', 'baking chocolate', 'theobromine'],
    level: 'hard_block',
    reason: 'Chocolate contains theobromine and caffeine, which are toxic to dogs and can cause vomiting, seizures, and death.',
    category: 'Food',
    symptoms: ['Vomiting', 'Diarrhea', 'Increased thirst', 'Restlessness', 'Rapid heart rate', 'Tremors', 'Seizures'],
    onset: '6–12 hours',
    guidance: 'Dark and baking chocolate are the most dangerous. Call your vet with the type and amount eaten.',
  },
  {
    name: 'grapes',
    aliases: ['grape', 'seedless grapes'],
    level: 'hard_block',
    reason: 'Grapes can cause acute kidney failure in dogs. Even small amounts can be dangerous.',
    category: 'Fruit',
    symptoms: ['Vomiting', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Abdominal pain', 'Decreased urination'],
    onset: '12–24 hours',
    guidance: 'No amount is known to be safe. Call your vet right away, even if your dog seems fine.',
  },
  {
    name: 'raisins',
    aliases: ['raisin', 'currants', 'sultanas', 'dried grapes'],
    level: 'hard_block',
    reason: 'Raisins can cause acute kidney failure in dogs. Even small amounts can be dangerous.',
    category: 'Fruit',
    symptoms: ['Vomiting', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Abdominal pain', 'Decreased urination'],
    onset: '12–24 hours',
    guidance: 'Watch for raisins in baked goods, trail mix and cereal. Call your vet right away.',
  },
  {
    name: 'onion',
    aliases: ['onions', 'raw onion', 'cooked onion', 'caramelized onion', 'onion flakes'],
    level: 'hard_block',
    reason: 'Onions contain compounds that destroy red blood cells in dogs, causing anemia.',
    category: 'Vegetable',
    symptoms: ['Weakness', 'Lethargy', 'Pale gums', 'Orange or dark red urine', 'Rapid breathing', 'Vomiting'],
    onset: '1–3 days',
    guidance: 'Raw, cooked and powdered forms are all toxic, including onion in broths and seasonings.',
  },
  {
    name: 'garlic',
    aliases: ['garlic cloves', 'raw garlic', 'cooked garlic', 'garlic bulb'],
    level: 'hard_block',
    reason: 'Garlic is toxic to dogs and can cause hemolytic anemia. More concentrated than onion.',
    category: 'Vegetable',
    symptoms: ['Weakness', 'Lethargy', 'Pale gums', 'Dark urine', 'Rapid breathing', 'Vomiting'],
    onset: '1–3 days',
    guidance: 'Garlic is several times stronger than onion. Check seasonings and garlic salt too.',
  },
  {
    name: 'leeks',
    title: 'Leeks, shallots, chives & scallions',
    aliases: ['leek', 'shallot', 'shallots', 'chive', 'chives', 'scallion', 'scallions', 'green onion', 'green onions', 'spring onion', 'spring onions'],
    level: 'hard_block',
    reason: 'Leeks, shallots, chives and scallions are in the onion family and can damage red blood cells in dogs.',
    category: 'Vegetable',
    symptoms: ['Weakness', 'Lethargy', 'Pale gums', 'Dark urine', 'Vomiting'],
    onset: '1–3 days',
    guidance: 'Treat every member of the onion family like onion.',
  },
  {
    name: 'xylitol',
    aliases: ['xylitol sweetener', 'birch sugar', 'sugar alcohol'],
    level: 'hard_block',
    reason: 'Xylitol causes rapid insulin release in dogs, leading to hypoglycemia and liver failure.',
    category: 'Sweetener',
    symptoms: ['Sudden drop in blood sugar', 'Vomiting', 'Weakness', 'Loss of coordination', 'Seizures', 'Liver failure'],
    onset: '15–30 minutes',
    guidance: 'An emergency. Found in sugar-free gum, some peanut butters and baked goods. Always check labels.',
  },
  {
    name: 'macadamia nuts',
    aliases: ['macadamia', 'macadamia nut', 'queensland nut'],
    level: 'hard_block',
    reason: 'Macadamia nuts cause weakness, vomiting, tremors, and hyperthermia in dogs.',
    category: 'Nut',
    symptoms: ['Weakness in the back legs', 'Vomiting', 'Tremors', 'Fever', 'Unable to walk'],
    onset: 'About 12 hours',
    guidance: 'Call your vet. Most dogs recover with care, but they need to be checked.',
  },
  {
    name: 'alcohol',
    aliases: ['beer', 'wine', 'liquor', 'ethanol', 'spirits', 'rum', 'vodka', 'whiskey', 'brandy'],
    level: 'hard_block',
    reason: 'Alcohol is toxic to dogs and can cause dangerous drops in blood sugar, blood pressure, and body temperature.',
    category: 'Drink',
    symptoms: ['Vomiting', 'Disorientation', 'Difficulty walking', 'Tremors', 'Slow breathing', 'Collapse'],
    onset: '30–60 minutes',
    guidance: 'An emergency. Includes alcohol in desserts, sauces and fermenting fruit.',
  },
  {
    name: 'caffeine',
    aliases: ['coffee', 'tea', 'energy drink', 'coffee grounds', 'espresso', 'green tea', 'tea bags', 'caffeine pills', 'cola'],
    level: 'hard_block',
    reason: 'Caffeine can cause rapid breathing, heart palpitations, muscle tremors, and seizures in dogs.',
    category: 'Drink',
    symptoms: ['Restlessness', 'Rapid heart rate', 'Tremors', 'Vomiting', 'Seizures'],
    onset: '1–2 hours',
    guidance: 'Coffee grounds, tea bags and caffeine pills are especially concentrated.',
  },
  {
    name: 'avocado',
    aliases: ['avocado flesh', 'guacamole', 'avocado pit', 'avocado skin', 'persin'],
    level: 'hard_block',
    reason: 'Avocado contains persin, which can cause vomiting and diarrhea in dogs.',
    category: 'Fruit',
    symptoms: ['Vomiting', 'Diarrhea'],
    onset: '24–48 hours',
    guidance: 'The pit is also a choking and blockage hazard. Guacamole often contains onion and garlic too.',
  },
  {
    name: 'raw yeast dough',
    aliases: ['yeast dough', 'bread dough', 'pizza dough', 'unbaked dough', 'raw bread', 'rising dough'],
    level: 'hard_block',
    reason: 'Raw yeast dough expands in the stomach and produces alcohol as it ferments, both of which are dangerous.',
    category: 'Food',
    symptoms: ['Bloated stomach', 'Vomiting or trying to vomit', 'Abdominal pain', 'Wobbliness'],
    onset: '1–2 hours',
    guidance: 'An emergency: the stomach can twist (bloat). Call your vet straight away.',
  },
  {
    name: 'nutmeg',
    aliases: ['ground nutmeg', 'myristica fragrans', 'mace'],
    level: 'hard_block',
    reason: 'Nutmeg contains myristicin, which causes hallucinations, seizures, and tremors in dogs.',
    category: 'Herb & spice',
    symptoms: ['Disorientation', 'Increased heart rate', 'High blood pressure', 'Tremors', 'Seizures'],
    onset: '3–8 hours',
    guidance: 'Watch for nutmeg in pumpkin pie spice, eggnog and baked goods.',
  },
  {
    name: 'hops',
    aliases: ['spent hops', 'brewing hops', 'humulus lupulus'],
    level: 'hard_block',
    reason: 'Hops can cause a dangerously high body temperature (malignant hyperthermia) in dogs.',
    category: 'Herb & spice',
    symptoms: ['Panting', 'Rapid heart rate', 'Very high temperature', 'Vomiting', 'Seizures'],
    onset: '2–6 hours',
    guidance: 'An emergency. Keep home-brewing supplies, including spent hops, away from dogs.',
  },
  {
    name: 'fruit pits',
    title: 'Stone fruit pits',
    aliases: ['cherry pits', 'cherry pit', 'cherry stones', 'peach pits', 'peach pit', 'peach stones', 'plum pits', 'plum pit', 'apricot pits', 'apricot pit', 'apricot kernels'],
    level: 'hard_block',
    reason: 'Stone fruit pits contain compounds that release cyanide, and they can choke or block the gut.',
    category: 'Fruit',
    symptoms: ['Dilated pupils', 'Difficulty breathing', 'Bright red gums', 'Vomiting', 'Shock'],
    onset: '15 minutes to a few hours',
    guidance: 'The flesh of most stone fruit is fine without the pit, stem and leaves.',
  },
  {
    name: 'wild mushrooms',
    aliases: ['wild mushroom', 'foraged mushrooms', 'toadstools', 'toadstool', 'death cap'],
    level: 'hard_block',
    reason: 'Many wild mushrooms are poisonous to dogs and can cause liver failure or death.',
    category: 'Other',
    symptoms: ['Vomiting', 'Diarrhea', 'Drooling', 'Wobbliness', 'Jaundice', 'Seizures'],
    onset: '30 minutes to 12 hours, depending on the species',
    guidance: 'An emergency. Take a photo or a sample of the mushroom to your vet.',
  },
  {
    name: 'rhubarb',
    aliases: ['rhubarb leaves', 'rhubarb stalks'],
    level: 'hard_block',
    reason: 'Rhubarb contains oxalates, which can cause kidney damage in dogs. The leaves are the most toxic part.',
    category: 'Vegetable',
    symptoms: ['Drooling', 'Vomiting', 'Diarrhea', 'Tremors', 'Changes in thirst or urination'],
    onset: '1–3 hours',
    guidance: 'Call your vet, especially if leaves were eaten.',
  },
  {
    name: 'moldy food',
    aliases: ['moldy', 'mouldy', 'mouldy food', 'spoiled food', 'mycotoxins'],
    level: 'hard_block',
    reason: 'Moldy food can contain mycotoxins that cause tremors and seizures in dogs.',
    category: 'Food',
    symptoms: ['Tremors', 'Seizures', 'Vomiting', 'High temperature'],
    onset: '30 minutes to 2 hours',
    guidance: 'Keep dogs out of compost, trash and old leftovers. Call your vet if tremors start.',
  },
  {
    name: 'tobacco',
    aliases: ['nicotine', 'cigarette', 'cigarettes', 'cigars', 'nicotine gum', 'vape juice', 'e-liquid'],
    level: 'hard_block',
    reason: 'Nicotine is toxic to dogs and can cause tremors, seizures, and heart problems.',
    category: 'Other',
    symptoms: ['Drooling', 'Vomiting', 'Tremors', 'Twitching', 'Rapid heart rate', 'Seizures'],
    onset: '15–45 minutes',
    guidance: 'An emergency. Vape liquid and nicotine gum (which may also contain xylitol) are especially dangerous.',
  },
  {
    name: 'star anise',
    aliases: ['japanese star anise'],
    level: 'warning',
    reason: 'Star anise can cause tremors and seizures in dogs; the Japanese variety is especially toxic.',
    category: 'Herb & spice',
    symptoms: ['Vomiting', 'Tremors', 'Seizures'],
    onset: '1–4 hours',
    guidance: 'Leave it out of dog food. Ask your vet if your dog ate some.',
  },
  {
    name: 'artificial sweeteners',
    aliases: ['artificial sweetener', 'aspartame', 'sucralose', 'saccharin', 'stevia', 'acesulfame'],
    level: 'warning',
    reason: 'Many artificial sweeteners (especially xylitol) are toxic to dogs. Others can upset the stomach.',
    category: 'Sweetener',
    symptoms: ['Vomiting', 'Diarrhea', 'Upset stomach'],
    onset: '1–2 hours',
    guidance: 'Check every "sugar-free" product for xylitol before it goes near your dog.',
  },
  {
    name: 'table salt',
    title: 'Salt',
    aliases: ['salt', 'sea salt', 'rock salt', 'kosher salt', 'sodium chloride', 'salt dough'],
    level: 'warning',
    reason: 'Dogs get the sodium they need from food. Added salt can cause salt poisoning in large amounts.',
    category: 'Additive',
    symptoms: ['Excessive thirst and urination', 'Vomiting', 'Diarrhea', 'Tremors', 'Seizures'],
    onset: '1–3 hours',
    guidance: 'Leave salt out of homemade dog food. Salt dough ornaments and rock salt are dangerous.',
  },
  {
    name: 'msg',
    title: 'MSG',
    aliases: ['monosodium glutamate', 'e621'],
    level: 'warning',
    reason: 'MSG is an unnecessary additive that can upset some dogs and is often found in salty, seasoned foods.',
    category: 'Additive',
    symptoms: ['Vomiting', 'Diarrhea', 'Restlessness'],
    onset: '1–2 hours',
    guidance: 'Avoid seasoned and processed foods for dogs.',
  },
  {
    name: 'propylene glycol',
    aliases: ['e1520'],
    level: 'warning',
    reason: 'Propylene glycol is an additive that is not needed in homemade dog food and can be harmful in large amounts.',
    category: 'Additive',
    symptoms: ['Lethargy', 'Wobbliness', 'Vomiting'],
    onset: '1–4 hours',
    guidance: 'Leave it out. Ask your vet if your dog ate a product that lists it high up.',
  },
  {
    name: 'raw potato',
    aliases: ['raw potatoes', 'green potato', 'green potatoes', 'potato sprouts', 'potato leaves'],
    level: 'warning',
    reason: 'Raw and green potatoes contain solanine, which can upset dogs. Plain cooked potato is fine.',
    category: 'Vegetable',
    symptoms: ['Vomiting', 'Diarrhea', 'Lethargy', 'Confusion'],
    onset: '2–4 hours',
    guidance: 'Cook potatoes plain and remove green parts and sprouts.',
  },
  {
    name: 'raw eggs',
    aliases: ['raw egg', 'raw egg whites', 'raw egg white', 'raw egg yolk'],
    level: 'warning',
    reason: 'Raw eggs carry a Salmonella risk, and raw egg whites can block biotin absorption over time. Cook eggs through.',
    category: 'Dairy & protein',
    symptoms: ['Vomiting', 'Diarrhea', 'Skin and coat problems (long term)'],
    onset: 'Hours (infection) or weeks (biotin)',
    guidance: 'Cheffo Doggo is lightly-cooked only: scramble or hard-boil eggs.',
  },
  {
    name: 'apple seeds',
    aliases: ['apple seed', 'apple core', 'apple cores'],
    level: 'warning',
    reason: 'Apple seeds contain compounds that release cyanide, and cores can be a choking hazard. Apple flesh is fine.',
    category: 'Fruit',
    symptoms: ['Vomiting', 'Difficulty breathing (large amounts)'],
    onset: 'Within hours',
    guidance: 'Core and seed apples before serving.',
  },
  {
    name: 'cooked bones',
    aliases: ['cooked bone', 'chicken bones', 'rib bones', 'pork bones'],
    level: 'warning',
    reason: 'Cooked bones splinter easily and can choke a dog or tear and block the gut.',
    category: 'Physical hazard',
    symptoms: ['Choking', 'Vomiting', 'Constipation', 'Straining', 'Bloody stool'],
    onset: 'Immediately to a few days',
    guidance: 'Call your vet if your dog is choking, in pain or straining. Strain all bones out of broths.',
  },
  {
    name: 'corn cob',
    title: 'Corn on the cob',
    aliases: ['corn cobs', 'corn on the cob'],
    level: 'warning',
    reason: 'Corn cobs do not digest and are a common cause of intestinal blockage. Corn kernels are fine.',
    category: 'Physical hazard',
    symptoms: ['Vomiting', 'Abdominal pain', 'Loss of appetite', 'Straining'],
    onset: '1–24 hours',
    guidance: 'Call your vet if your dog swallowed a piece of cob. Surgery is sometimes needed.',
  },
  {
    name: 'peanut butter',
    title: 'Peanut butter (xylitol-free)',
    aliases: [],
    level: 'info',
    reason: 'Plain, xylitol-free peanut butter is fine as a treat. It is high in fat, so keep portions small.',
    category: 'Nut',
    guidance: 'Read the label every time: some brands add xylitol ("birch sugar"), which is toxic.',
  },
  {
    name: 'dairy',
    title: 'Dairy (cheese, yogurt, milk)',
    aliases: ['cheese', 'yogurt', 'cottage cheese', 'milk'],
    level: 'info',
    reason: 'Many dogs handle small amounts of plain yogurt or low-fat cheese, but some are lactose intolerant.',
    category: 'Dairy & protein',
    guidance: 'Start small and stop if you see gas or loose stool. Avoid flavored or sweetened products.',
  },
  {
    name: 'liver',
    title: 'Liver and organ meat',
    aliases: ['chicken liver', 'beef liver', 'organ meat'],
    level: 'info',
    reason: 'Liver is nutritious, but too much can cause vitamin A excess over time.',
    category: 'Dairy & protein',
    guidance: 'Keep liver to a small share of the diet; your vet can advise on amounts.',
  },
  {
    name: 'store-bought mushrooms',
    title: 'Store-bought mushrooms (plain, cooked)',
    aliases: [],
    level: 'info',
    reason: 'Plain cooked grocery-store mushrooms are generally fine in small amounts. Wild mushrooms are not.',
    category: 'Vegetable',
    guidance: 'Serve plain, with no butter, garlic, onion or salt.',
  },
  {
    name: 'cinnamon',
    aliases: [],
    level: 'info',
    reason: 'A light sprinkle of cinnamon is not toxic, but large amounts can irritate the mouth and stomach.',
    category: 'Herb & spice',
    guidance: 'Use a pinch at most, and never spice mixes that may contain nutmeg.',
  },
];

// Warning-level risky terms (pattern matching, not exact)
export const RISKY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /onion\s*powder/i, reason: 'Onion powder is highly concentrated and toxic to dogs.' },
  { pattern: /garlic\s*powder/i, reason: 'Garlic powder is highly concentrated and toxic to dogs.' },
  { pattern: /seasoned\s*meat/i, reason: 'Seasoned meat may contain spices, garlic, or onion toxic to dogs. Use plain unseasoned meat.' },
  { pattern: /salty\s*broth/i, reason: 'High-sodium broths are not safe for dogs. Use low-sodium or homemade plain broth.' },
  { pattern: /spicy/i, reason: 'Spicy ingredients can cause stomach upset and pain in dogs.' },
  { pattern: /pumpkin\s*pie\s*filling/i, reason: 'Pumpkin pie filling contains sugar and spices. Use plain, unsweetened canned pumpkin only.' },
  { pattern: /added\s*sugar/i, reason: 'Added sugar is not appropriate for dogs and can contribute to obesity and dental problems.' },
  { pattern: /store[\s-]?bought\s*broth/i, reason: 'Most store-bought broths contain onion, garlic, or high sodium. Use low-sodium plain broth or homemade.' },
];

export function checkToxic(text: string): { errors: string[]; warnings: string[] } {
  // Negated mentions are safety LABELS, not ingredients: "Peanut Butter
  // (xylitol-free)" must not trip the xylitol hard-block. Blank out
  // "<term>-free", "<term> free", "no <term>", and "without <term>" before
  // matching. (\bxylitol\b matches inside "xylitol-free" — hyphen is a word
  // boundary — which made the PB Banana Bites template fail generation.)
  const lower = text.toLowerCase()
    .replace(/\b[a-z]+[\s-]free\b/g, ' ')
    .replace(/\b(?:no|without)\s+[a-z]+\b/g, ' ');
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of TOXIC_INGREDIENTS) {
    if (entry.level === 'info') continue;
    const allNames = [entry.name, ...entry.aliases];
    const found = allNames.some(n => {
      const pattern = new RegExp(`\\b${n.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      return pattern.test(lower);
    });
    if (found) {
      if (entry.level === 'hard_block') {
        errors.push(`"${entry.name}" is toxic to dogs. ${entry.reason}`);
      } else {
        warnings.push(`Caution: "${entry.name}". ${entry.reason}`);
      }
    }
  }

  for (const { pattern, reason } of RISKY_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(reason);
    }
  }

  return { errors, warnings };
}

// Names of every hard-blocked entry, for prompts and help copy.
export function hardBlockedNames(): string[] {
  return TOXIC_INGREDIENTS.filter(e => e.level === 'hard_block').map(e => e.title ?? e.name);
}
