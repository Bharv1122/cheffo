export interface SupplementReference {
  id: string;
  name: string;
  category: 'calcium' | 'omega3' | 'multivitamin' | 'probiotic' | 'joint';
  isRequired: boolean;
  whyNeeded: string;
  educationalNote: string;
  estimatedRangeNote: string;
  vetReviewRequired: true;
  commonSources: string[];
  exampleProducts?: string[];
}

export const SUPPLEMENT_REFERENCE: SupplementReference[] = [
  {
    id: 'calcium',
    name: 'Calcium Source',
    category: 'calcium',
    isRequired: true,
    whyNeeded: 'Homemade diets without raw meaty bones are almost always calcium-deficient. Calcium is essential for bones, teeth, muscle function, and nerve signaling.',
    educationalNote: 'Homemade dog food needs a calcium source unless you\'re feeding raw meaty bones. Without adequate calcium, dogs can develop serious bone problems over time.',
    estimatedRangeNote: 'Roughly 1,000–1,200mg calcium per pound of food is a common starting point, but amounts vary widely by age, weight, and recipe. Puppies need more. Budget tip: eggshell powder works — wash empty shells, bake at 300°F for 5–10 minutes to dry and sanitize, grind to a fine powder in a coffee grinder, and store airtight. About ½ tsp of eggshell powder ≈ 1,000mg calcium. Confirm amounts with your vet.',
    vetReviewRequired: true,
    commonSources: ['Eggshell powder (~2,000mg per tsp)', 'Calcium carbonate powder', 'Calcium citrate', 'Raw meaty bones (whole ground)'],
    exampleProducts: ['NOW Calcium Carbonate Powder', 'Bob\'s Red Mill Calcium Powder'],
  },
  {
    id: 'omega3',
    name: 'Omega-3 (EPA/DHA)',
    category: 'omega3',
    isRequired: true,
    whyNeeded: 'Most homemade diets are high in omega-6 and low in omega-3. EPA and DHA support skin, coat, joints, brain, and heart health.',
    educationalNote: 'Without an omega-3 supplement, homemade diets can have an imbalanced omega-6 to omega-3 ratio. Fish oil is the most bioavailable source.',
    estimatedRangeNote: 'A rough starting estimate is 20–55mg EPA+DHA per kilogram of body weight daily, but the right dose depends on your dog\'s health and diet. Confirm with your vet.',
    vetReviewRequired: true,
    commonSources: ['Fish oil (salmon, cod liver, anchovy)', 'Whole sardines (canned in water)', 'Whole cooked salmon', 'Krill oil'],
    exampleProducts: ['Zesty Paws Pure Wild Alaskan Salmon Oil', 'Nordic Naturals Omega-3 Pet'],
  },
  {
    id: 'multivitamin',
    name: 'Canine Multivitamin',
    category: 'multivitamin',
    isRequired: false,
    whyNeeded: 'Homemade diets often miss trace minerals and vitamins (B12, D3, zinc, iodine, vitamin E) that are hard to provide through food alone.',
    educationalNote: 'A canine-specific multivitamin designed for homemade diets helps fill the nutritional gaps that whole food ingredients can\'t always cover.',
    estimatedRangeNote: 'Follow product label dosing. Many homemade-diet multivitamins are dosed by weight. Not all dog vitamins are designed for homemade feeding — look for ones formulated specifically for homemade diets.',
    vetReviewRequired: true,
    commonSources: ['Canine homemade diet supplements', 'Species-specific multivitamin powder', 'Vet-formulated complete supplements'],
    exampleProducts: ['BalanceIT Canine', 'Rx Vitamins Nutritional Support', 'Animal Essentials SeaMeal'],
  },
  {
    id: 'probiotic',
    name: 'Probiotic (optional)',
    category: 'probiotic',
    isRequired: false,
    whyNeeded: 'Probiotics support gut health and immune function. Helpful during diet transitions, after antibiotics, or for dogs with sensitive stomachs.',
    educationalNote: 'Not required for all dogs but beneficial for digestive health. Plain Greek yogurt with live cultures can be a natural option.',
    estimatedRangeNote: 'Follow product label dosing. Canine-specific probiotics are preferred over human formulations.',
    vetReviewRequired: true,
    commonSources: ['Plain Greek yogurt (live cultures)', 'Dog-specific probiotic powder', 'Fermented vegetables (small amounts)', 'Kefir (plain, no sugar)'],
    exampleProducts: ['Purina FortiFlora', 'Zesty Paws Probiotic Bites', 'Nusentia Probiotic Miracle'],
  },
  {
    id: 'joint',
    name: 'Joint Support (optional)',
    category: 'joint',
    isRequired: false,
    whyNeeded: 'Glucosamine and chondroitin support cartilage health and joint comfort, especially for larger breeds, seniors, or active dogs.',
    educationalNote: 'Particularly helpful for large breeds, senior dogs, or dogs with known joint issues. Not needed for all dogs.',
    estimatedRangeNote: 'Typical starting range: 500–1,000mg glucosamine per day for medium dogs, scaled up for larger dogs. Confirm with your vet, especially if your dog has a joint condition.',
    vetReviewRequired: true,
    commonSources: ['Glucosamine + chondroitin supplement', 'Green-lipped mussel powder', 'Bone broth (plain, unsalted)'],
    exampleProducts: ['Cosequin DS', 'Nutramax Dasuquin', 'Zesty Paws Hip & Joint'],
  },
];

export const VET_DISCLAIMER =
  'Homemade dog food usually needs supplementation to be nutritionally complete. The supplement information above is educational guidance — estimated amounts and ranges that may serve as a starting point for discussion with your veterinarian. Final supplement types, amounts, and products should always be confirmed with a licensed veterinarian or veterinary nutritionist. This is not veterinary advice.';

export const SUPPLEMENT_DISCLAIMER_SHORT =
  'Estimated supplement checklist — review with your veterinarian before use.';

export function getRequiredSupplements(): SupplementReference[] {
  return SUPPLEMENT_REFERENCE.filter(s => s.isRequired);
}

export function getAllSupplements(): SupplementReference[] {
  return SUPPLEMENT_REFERENCE;
}
