import type { ResearchOutput } from "@repo/backend/confect/nina/research/schema";
import { Array as Arr, pipe } from "effect";

/** Renders structured research findings as markdown with inline citations. */
export function formatResearchOutput(output: ResearchOutput) {
  const findings = pipe(
    output.findings,
    Arr.map(formatFinding),
    Arr.join("\n\n")
  );
  const limitations = formatLimitations(output.limitations);

  if (!findings) {
    return output.noEvidenceAnswer;
  }

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

  return pipe(
    citations,
    Arr.flatMap((citation) => {
      if (seen.has(citation.url)) {
        return [];
      }

      seen.add(citation.url);
      return [`[${citation.title}](${citation.url})`];
    }),
    Arr.join(" ")
  );
}

/** Renders caveats without pretending they are sourced claims. */
function formatLimitations(limitations: ResearchOutput["limitations"]) {
  if (limitations.length === 0) {
    return "";
  }

  return pipe(
    limitations,
    Arr.map((limitation) => `- ${limitation}`),
    Arr.join("\n")
  );
}
