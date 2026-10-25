import { Array as Arr } from "effect";
import type { LlmsEntry } from "@/lib/llms/entries";
import { AGENT_MARKDOWN_DIRECTIVE } from "@/lib/llms/format";

/** Renders one LLMS index document with the standard title and summary shape. */
export function renderLlmsIndexText({
  lines,
  summary,
  title,
}: {
  lines: string[];
  summary: string;
  title: string;
}) {
  return Arr.join(
    [
      `# ${title}`,
      "",
      `> ${summary}`,
      "",
      AGENT_MARKDOWN_DIRECTIVE,
      "",
      "## Pages",
      "",
      ...lines,
      "",
    ],
    "\n"
  );
}

/** Formats one page-level llms entry line. */
export function formatLlmsEntryLine(entry: LlmsEntry) {
  const suffix = entry.description ? `: ${entry.description}` : "";
  return `- [${entry.title}](${entry.href})${suffix}`;
}
