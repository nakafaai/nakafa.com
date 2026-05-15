const indexedSourcePattern =
  /(?:^|\n)\s*[-*]\s+(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))\s+\[(\d+)\]/gu;

const citationGroupPattern = /\[(?<indexes>\d+(?:\s*,\s*\d+)*)\]/gu;
const sourceIndexLabelPattern = /\s+\[\d+\]$/u;
const sourceLinePrefixPattern =
  /^\s*[-*]\s+\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)\s*$/u;

/** Converts provider-style citation indexes into markdown source links. */
export function normalizeResearchCitations(text: string) {
  const citationsByIndex = getCitationsByIndex(text);

  if (citationsByIndex.size === 0) {
    return text;
  }

  const normalizedText = text.replace(
    citationGroupPattern,
    (match, indexes: string, offset: number, source: string) => {
      if (isIndexedSourceLine({ offset, source })) {
        return match;
      }

      const citations = indexes
        .split(",")
        .map((index) => citationsByIndex.get(index.trim()))
        .filter(Boolean);

      if (citations.length !== indexes.split(",").length) {
        return match;
      }

      return citations.join(" ");
    }
  );

  return normalizedText.replace(indexedSourcePattern, (match) =>
    match.replace(sourceIndexLabelPattern, "")
  );
}

/** Reads numbered markdown links from a research Sources section. */
function getCitationsByIndex(text: string) {
  const citationsByIndex = new Map<string, string>();

  for (const [, citation, index] of text.matchAll(indexedSourcePattern)) {
    citationsByIndex.set(index, citation);
  }

  return citationsByIndex;
}

/** Keeps source-list labels like `[12]` from becoming duplicated inline links. */
function isIndexedSourceLine({
  offset,
  source,
}: {
  offset: number;
  source: string;
}) {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const prefix = source.slice(lineStart, offset);

  return sourceLinePrefixPattern.test(prefix);
}
