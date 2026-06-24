import type { VerificationLane } from "@repo/math/schema/lane";
import type { MathResult } from "@repo/math/schema/result";

/** Maps deterministic CAS status into the canonical MathWork trust lane. */
export function laneFromResult(result: MathResult): VerificationLane {
  if (result.status === "verified") {
    return "verified";
  }

  if (result.status === "contradicted") {
    return "verified";
  }

  return "speculative";
}

/** Maps deterministic CAS step coverage into the canonical step trust lane. */
export function laneFromStepStatus(result: MathResult): VerificationLane {
  if (result.stepStatus === "complete") {
    return "derived";
  }

  if (result.stepStatus === "partial") {
    return "derived";
  }

  return laneFromResult(result);
}
