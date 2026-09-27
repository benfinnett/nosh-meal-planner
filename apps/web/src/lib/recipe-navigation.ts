// The query cache retains pages; this small session map retains their visual position.
export const explorerPositions = new Map<
  string,
  { scroll: number; cardId: string }
>();

const dietaryLabels: Record<string, { title: string; short: string }> = {
  vegan: { title: "Vegan", short: "Ve" },
  vegetarian: { title: "Vegetarian", short: "V" },
  "gluten-free": { title: "Gluten-Free", short: "GF" },
  "dairy-free": { title: "Dairy-Free", short: "DF" },
};

export function label(value: string) {
  const words = value.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function dietaryShortLabel(value: string) {
  return dietaryLabels[value]?.short ?? label(value);
}

export function dietaryDisplayLabel(value: string) {
  const dietaryLabel = dietaryLabels[value];
  return dietaryLabel
    ? `${dietaryLabel.title} (${dietaryLabel.short})`
    : label(value);
}
