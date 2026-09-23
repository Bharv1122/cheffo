export function replaceIngredientReference(
  value: string | undefined,
  previousName: string,
  nextName: string,
): string | undefined {
  if (!value) return value;
  const escaped = previousName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(escaped, 'gi'), nextName);
}
