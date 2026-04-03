import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/convex/tryouts/products";

/** Maps latent theta onto the current public report-score scale for one product. */
export function getTryoutReportScore(
  product: TryoutProduct,
  theta: Doc<"tryoutAttempts">["theta"]
) {
  return tryoutProductPolicies[product].scaleThetaToScore(theta);
}
