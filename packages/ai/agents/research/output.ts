import type { ResearchOutput } from "@repo/ai/agents/research/schema";

/** Renders structured research findings as markdown with inline citations. */
export function formatResearchOutput(output: ResearchOutput) {
  const findings = output.findings.map(formatFinding).join("\n\n");
  const limitations = formatLimitations(output.limitations);

  if (!limitations) {
    return findings;
  }

  return `${findings}\n\n${limitations}`;
}

/** Renders one source-backed finding with citations beside the claim. */
function formatFinding(finding: ResearchOutput["findings"][number]) {
  return `- ${finding.text} ${formatCitations(finding.citations)}`;
}

/** Keeps duplicate URLs out of one inline citation group. */
function formatCitations(
  citations: ResearchOutput["findings"][number]["citations"]
) {
  const seen = new Set<string>();

  return citations
    .flatMap((citation) => {
      if (seen.has(citation.url)) {
        return [];
      }

      seen.add(citation.url);
      return [`[${citation.title}](${citation.url})`];
    })
    .join(" ");
}

/** Renders caveats without pretending they are sourced claims. */
function formatLimitations(limitations: ResearchOutput["limitations"]) {
  if (limitations.length === 0) {
    return "";
  }

  return [
    "## Limitations",
    "",
    ...limitations.map((limitation) => `- ${limitation}`),
  ].join("\n");
}
