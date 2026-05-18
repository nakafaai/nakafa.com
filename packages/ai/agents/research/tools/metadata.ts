import type { DocumentMetadata } from "@mendable/firecrawl-js";

/** Selects source metadata that should survive the research pipeline. */
export function getDocumentMetadata({
  description,
  metadata,
  title,
}: {
  description?: string;
  metadata?: DocumentMetadata;
  title?: string;
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

/** Returns the first non-empty provider metadata value. */
export function firstText(...values: (string | undefined)[]) {
  for (const value of values) {
    const text = value?.trim();

    if (text) {
      return text;
    }
  }

  return;
}
