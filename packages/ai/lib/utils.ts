import type { GetContentsInput } from "../schema/tools";

export function buildContentSlug(params: GetContentsInput): string {
  const { locale, filters } = params;
  const { type, category, grade, material } = filters;

  const segments: string[] = [locale, type];

  if (category) {
    segments.push(category);

    if (type === "subject" && grade) {
      segments.push(grade);

      if (material) {
        segments.push(material);
      }
    }
  }

  return segments.join("/");
}
