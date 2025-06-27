import type { GetContentsParams } from "./schema";

export function buildContentSlug(params: GetContentsParams): string {
  const { locale, filters } = params;
  const { type, category, grade, material } = filters;

  const segments: string[] = [locale, type];

  if (category) {
    segments.push(category);

    if (grade) {
      segments.push(grade);

      if (material) {
        segments.push(material);
      }
    }
  }

  return segments.join("/");
}
