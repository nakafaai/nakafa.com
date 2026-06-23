import type {
  CapabilityContribution,
  EvidenceWorkspace,
} from "@repo/ai/nina/workspace/schema";

/**
 * Enforces workspace-wide ownership rules that need multiple contributions.
 */
export function findWorkspaceIssue(workspace: EvidenceWorkspace) {
  const artifactIds = new Set<string>();

  for (const contribution of workspace.contributions) {
    if (contribution.capability !== contribution.evidence.capability) {
      return `Contribution capability ${contribution.capability} does not match evidence capability ${contribution.evidence.capability}.`;
    }

    const unavailableIssue = findUnavailableEvidenceIssue(contribution);
    if (unavailableIssue) {
      return unavailableIssue;
    }

    const refsIssue = findPedagogyRefsIssue(contribution);
    if (refsIssue) {
      return refsIssue;
    }

    const artifacts = contribution.artifacts;
    if (!artifacts) {
      continue;
    }

    for (const artifact of artifacts) {
      if (artifactIds.has(artifact.id)) {
        return `Duplicate learning artifact id: ${artifact.id}.`;
      }
      artifactIds.add(artifact.id);
    }
  }
}

/**
 * Prevents failed or denied evidence from contributing artifacts or pedagogy.
 */
function findUnavailableEvidenceIssue(contribution: CapabilityContribution) {
  if (
    contribution.evidence.status !== "failed" &&
    contribution.evidence.status !== "denied"
  ) {
    return;
  }

  if (contribution.artifacts?.length) {
    return `Contribution ${contribution.capability} cannot attach artifacts when evidence status is ${contribution.evidence.status}.`;
  }

  if (contribution.pedagogyMoves?.length) {
    return `Contribution ${contribution.capability} cannot attach pedagogy moves when evidence status is ${contribution.evidence.status}.`;
  }
}

/**
 * Requires pedagogy moves to cite evidence refs or artifact ids from the same contribution.
 */
function findPedagogyRefsIssue(contribution: CapabilityContribution) {
  if (!contribution.pedagogyMoves) {
    return;
  }

  const allowedRefs = new Set<string>();

  if (contribution.evidence.refs) {
    for (const ref of contribution.evidence.refs) {
      allowedRefs.add(ref);
    }
  }

  if (contribution.artifacts) {
    for (const artifact of contribution.artifacts) {
      allowedRefs.add(artifact.id);
    }
  }

  for (const move of contribution.pedagogyMoves) {
    for (const ref of move.evidenceRefs) {
      if (!allowedRefs.has(ref)) {
        return `Pedagogy move ${move.kind} references unknown evidence ${ref}.`;
      }
    }
  }
}
