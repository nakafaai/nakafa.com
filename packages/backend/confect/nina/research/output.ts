import { formatUnreadSources } from "@repo/backend/confect/nina/research/messages";
import type { ResearchOutput } from "@repo/backend/confect/nina/research/schema";
import { Array as Arr, pipe } from "effect";

/**
 * What Nina reads when a research run ends without a source-backed finding.
 * It tells her what to say, from the limitations that follow it or from the
 * request when none follow; she writes it in the learner's language.
 */
const noFindings =
  "Research returned no source-backed finding. Tell the learner what this attempt could not verify. The limitations that follow say it; when none follow, it is the request itself. Name a direct channel they can check next. Do not claim that anything is absent or does not exist.";

/**
 * Renders structured research findings as markdown with inline citations.
 * Limitations follow the findings, or the no-finding instruction.
 */
export function formatResearchOutput(output: ResearchOutput) {
  const findings = pipe(
    output.findings,
    Arr.map(formatFinding),
    Arr.join("\n\n")
  );
  return pipe(
    [findings || noFindings, ...Arr.map(output.limitations, formatLimitation)],
    Arr.join("\n\n")
  );
}

/**
 * Hands Nina the collected sources when synthesis returned nothing usable, so
 * the evidence the learner sees is also the evidence she answers from.
 */
export function formatUnsynthesizedEvidence(
  evidence: readonly string[],
  unread: readonly string[]
) {
  return pipe(
    [
      "Research synthesis was unavailable. The collected source evidence follows. Answer only from it, cite only its URLs, and say that the research is incomplete.",
      ...evidence,
      ...formatUnreadSources(unread),
    ],
    Arr.join("\n\n")
  );
}

/** Renders one source-backed finding with citations beside the claim. */
function formatFinding(finding: ResearchOutput["findings"][number]) {
  return `- ${finding.text} ${formatCitations(finding.citations)}`;
}

/** Keeps duplicate URLs out of one inline citation group. */
function formatCitations(
  citations: ResearchOutput["findings"][number]["citations"]
) {
  return pipe(
    Arr.dedupeWith(citations, (left, right) => left.url === right.url),
    Arr.map((citation) => `[${citation.title}](${citation.url})`),
    Arr.join(" ")
  );
}

/** Renders one caveat without pretending it is a sourced claim. */
function formatLimitation(limitation: string) {
  return `- ${limitation}`;
}
