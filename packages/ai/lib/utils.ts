import dedent from "dedent";

export function buildContentSlug(params: {
  locale: string;
  filters: {
    type: "articles" | "subject";
    category?: string;
    grade?: string;
    material?: string;
  };
}): string {
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

export function cleanSlug(slug: string): string {
  // remove slash at the beginning and the end
  return slug.replace(/^\/+|\/+$/g, "");
}

export function dedentString(text: string): string {
  return dedent(text);
}
