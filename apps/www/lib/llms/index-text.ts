import type { LlmsEntry } from "@/lib/llms/entries";

/** Renders one llms index document with the standard title and summary shape. */
export function renderLlmsIndexText({
  lines,
  summary,
  title,
}: {
  lines: string[];
  summary: string;
  title: string;
}) {
  return [
    `# ${title}`,
    "",
    `> ${summary}`,
    "",
    "## Pages",
    "",
    ...lines,
    "",
  ].join("\n");
}

/** Formats one page-level llms entry line. */
export function formatLlmsEntryLine(entry: LlmsEntry) {
  const suffix = entry.description ? `: ${entry.description}` : "";
  return `- [${entry.title}](${entry.href})${suffix}`;
}
