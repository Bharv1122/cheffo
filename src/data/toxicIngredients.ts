export interface ToxicEntry {
  name: string;
  aliases: string[];
  level: 'hard_block' | 'warning';
  reason: string;
}

// Hard-block: recipe generation stops completely
// Warning: shown prominently but does not block generation
export const TOXIC_INGREDIENTS: ToxicEntry[] = [
  {
    name: 'chocolate',
    aliases: ['cocoa', 'cacao', 'dark chocolate', 'milk chocolate', 'white chocolate', 'chocolate chips', 'baking chocolate'],
    level: 'hard_block',
    reason: 'Chocolate contains theobromine and caffeine, which are toxic to dogs and can cause vomiting, seizures, and death.',
  },
  {
    name: 'grapes',
    aliases: ['grape', 'seedless grapes'],
    level: 'hard_block',
    reason: 'Grapes can cause acute kidney failure in dogs. Even small amounts can be dangerous.',
  },
  {
    name: 'raisins',
    aliases: ['raisin', 'currants', 'sultanas', 'dried grapes'],
    level: 'hard_block',
    reason: 'Raisins can cause acute kidney failure in dogs. Even small amounts can be dangerous.',
  },
  {
    name: 'onion',
    aliases: ['onions', 'raw onion', 'cooked onion', 'caramelized onion', 'onion flakes'],
    level: 'hard_block',
    reason: 'Onions contain compounds that destroy red blood cells in dogs, causing anemia.',
  },
  {
    name: 'garlic',
    aliases: ['garlic cloves', 'raw garlic', 'cooked garlic', 'garlic bulb'],
    level: 'hard_block',
    reason: 'Garlic is toxic to dogs and can cause hemolytic anemia. More concentrated than onion.',
  },
  {
    name: 'xylitol',
    aliases: ['xylitol sweetener', 'birch sugar', 'sugar alcohol'],
    level: 'hard_block',
    reason: 'Xylitol causes rapid insulin release in dogs, leading to hypoglycemia and liver failure.',
  },
  {
    name: 'macadamia nuts',
    aliases: ['macadamia', 'macadamia nut'],
    level: 'hard_block',
    reason: 'Macadamia nuts cause weakness, vomiting, tremors, and hyperthermia in dogs.',
  },
  {
    name: 'alcohol',
    aliases: ['beer', 'wine', 'liquor', 'ethanol', 'spirits', 'rum', 'vodka', 'whiskey', 'brandy'],
    level: 'hard_block',
    reason: 'Alcohol is toxic to dogs and can cause dangerous drops in blood sugar, blood pressure, and body temperature.',
  },
  {
    name: 'caffeine',
    aliases: ['coffee', 'tea', 'energy drink', 'coffee grounds', 'espresso', 'green tea'],
    level: 'hard_block',
    reason: 'Caffeine can cause rapid breathing, heart palpitations, muscle tremors, and seizures in dogs.',
  },
  {
    name: 'avocado',
    aliases: ['avocado flesh', 'guacamole'],
    level: 'hard_block',
    reason: 'Avocado contains persin, which can cause vomiting and diarrhea in dogs.',
  },
  {
    name: 'raw yeast dough',
    aliases: ['yeast dough', 'bread dough', 'pizza dough', 'unbaked dough', 'raw bread'],
    level: 'hard_block',
    reason: 'Raw yeast dough expands in the stomach and produces alcohol as it ferments, both of which are dangerous.',
  },
  {
    name: 'nutmeg',
    aliases: ['ground nutmeg', 'myristica fragrans'],
    level: 'hard_block',
    reason: 'Nutmeg contains myristicin, which causes hallucinations, seizures, and tremors in dogs.',
  },
];

// Warning-level risky terms (pattern matching, not exact)
export const RISKY_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /onion\s*powder/i, reason: 'Onion powder is highly concentrated and toxic to dogs.' },
  { pattern: /garlic\s*powder/i, reason: 'Garlic powder is highly concentrated and toxic to dogs.' },
  { pattern: /seasoned\s*meat/i, reason: 'Seasoned meat may contain spices, garlic, or onion toxic to dogs. Use plain unseasoned meat.' },
  { pattern: /salty\s*broth/i, reason: 'High-sodium broths are not safe for dogs. Use low-sodium or homemade plain broth.' },
  { pattern: /spicy/i, reason: 'Spicy ingredients can cause stomach upset and pain in dogs.' },
  { pattern: /artificial\s*sweetener/i, reason: 'Many artificial sweeteners (especially xylitol) are toxic to dogs.' },
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
