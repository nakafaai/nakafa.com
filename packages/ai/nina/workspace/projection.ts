import type {
  CapabilityContribution,
  EvidenceWorkspace,
} from "@repo/ai/nina/workspace/schema";

const MAX_PROJECTION_ITEMS = 8;

/**
 * Renders the bounded workspace state Nina may show to later model steps.
 * The projection contains evidence summaries and references only, never raw
 * specialist transcripts or full artifact payloads.
 */
export function formatEvidenceWorkspaceProjection(
  workspace: EvidenceWorkspace
) {
  const contributions = workspace.contributions.slice(-MAX_PROJECTION_ITEMS);
  if (contributions.length === 0) {
    return;
  }

  return [
    "# Evidence Workspace Projection",
    "",
    "Use this compact, typed workspace state to ground later steps.",
    ...contributions.flatMap(formatContributionProjection),
  ].join("\n");
}

/**
 * Formats one capability contribution with enough identity for source policy.
 */
function formatContributionProjection(contribution: CapabilityContribution) {
  const lines = [
    "",
    `- Capability: ${contribution.capability}`,
    `  Status: ${contribution.evidence.status}`,
    `  Summary: ${contribution.modelSummary}`,
  ];

  if (contribution.evidence.refs?.length) {
    lines.push(`  References: ${contribution.evidence.refs.join(", ")}`);
  }

  if (contribution.evidence.limitations?.length) {
    lines.push(
      `  Limitations: ${contribution.evidence.limitations.join("; ")}`
    );
  }

  if (contribution.pedagogyMoves?.length) {
    lines.push(
      `  Pedagogy: ${contribution.pedagogyMoves
        .map((move) => `${move.kind}: ${move.summary}`)
        .join("; ")}`
    );
  }

  if (contribution.artifacts?.length) {
    lines.push(
      `  Artifacts: ${contribution.artifacts
        .map((artifact) => artifact.id)
        .join(", ")}`
    );
  }

  return lines;
}
