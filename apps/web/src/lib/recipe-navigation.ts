// The query cache retains pages; this small session map retains their visual position.
export const explorerPositions = new Map<
  string,
  { scroll: number; cardId: string }
>();

export function label(value: string) {
  const words = value.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
