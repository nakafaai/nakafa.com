import type {
  PageMetadata,
  ProviderText,
} from "@repo/backend/confect/nina/research/provider";

/** Selects source metadata that should survive the research pipeline. */
export function getDocumentMetadata({
  description,
  metadata,
  title,
}: {
  description?: ProviderText | undefined;
  metadata?: PageMetadata | null | undefined;
  title?: ProviderText | undefined;
}) {
  const sourceTitle = firstText(title, metadata?.title, metadata?.ogTitle);
  const sourceDescription = firstText(
    description,
    metadata?.description,
    metadata?.ogDescription,
    metadata?.dcDescription
  );
  const favicon = firstText(metadata?.favicon);

  return {
    ...(sourceTitle ? { title: sourceTitle } : {}),
    ...(sourceDescription ? { description: sourceDescription } : {}),
    ...(favicon ? { favicon } : {}),
  };
}

/**
 * Returns the first non-empty provider text. A list of texts counts as its
 * items in order, because a page that repeats a tag gives the provider a list.
 */
export function firstText(...values: (ProviderText | undefined)[]) {
  for (const value of values) {
    for (const item of typeof value === "string" ? [value] : (value ?? [])) {
      const text = item.trim();

      if (text) {
        return text;
      }
    }
  }
}
