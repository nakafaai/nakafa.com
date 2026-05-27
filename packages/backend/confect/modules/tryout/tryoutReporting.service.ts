import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/confect/modules/tryout/products";

/** Converts operational IRT theta into the public product score scale. */
export function getTryoutReportScore(product: TryoutProduct, theta: number) {
  return tryoutProductPolicies[product].scaleThetaToScore(theta);
}
