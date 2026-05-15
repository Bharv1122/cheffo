import { readFileSync } from 'node:fs';

const recipeInsights = readFileSync('src/utils/recipeInsights.ts', 'utf8');
const recipeDetail = readFileSync('src/pages/Recipes/RecipeDetail.tsx', 'utf8');
const vetExport = readFileSync('src/pages/VetExport/index.tsx', 'utf8');

const requiredPhotoMarkers = [
  'images.unsplash.com',
  'real food photo',
  'REAL_RECIPE_PHOTOS',
];

const missingPhotoMarkers = requiredPhotoMarkers.filter(marker => !recipeInsights.includes(marker));
if (missingPhotoMarkers.length) {
  throw new Error(`Recipe photo helper is missing real-photo markers: ${missingPhotoMarkers.join(', ')}`);
}

if (recipeInsights.includes('buildPhotoDataUri(meta)')) {
  throw new Error('Recipe cards should not fall back to generated SVG emoji art when real recipe photos are available.');
}

const requiredVetMarkers = [
  'Email Vet',
  'Copy Email Template',
  'Subject: Vet review requested',
  'Veterinary Review Email Template',
  'navigator.clipboard.writeText',
];

const missingVetMarkers = requiredVetMarkers.filter(marker => !vetExport.includes(marker));
if (missingVetMarkers.length) {
  throw new Error(`Vet export page is missing email/print template markers: ${missingVetMarkers.join(', ')}`);
}

if (!recipeDetail.includes('navigate(`/vet-export/${recipe.id}`)')) {
  throw new Error('Recipe detail page should expose a vet review/export action.');
}

console.log('real recipe photos and vet email/print template verified');
