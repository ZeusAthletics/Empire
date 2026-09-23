export function mapIconAssetUrl(setSlug: string, index: number): string {
  return `/map-icons/${setSlug}/icons/${String(index).padStart(2, "0")}.png`;
}
