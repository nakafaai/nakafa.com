import { compare } from "@repo/math/core/compare";
import { differentiate } from "@repo/math/core/differentiate";
import { evaluate } from "@repo/math/core/evaluate";
import { simplify } from "@repo/math/core/simplify";
import { Effect } from "effect";

/**
 * Deterministic math service backed by Math.js.
 *
 * References:
 * - Effect services: https://effect.website/docs/requirements-management/services/
 * - Math.js algebra: https://mathjs.org/docs/expressions/algebra.html
 * - Math.js derivative: https://mathjs.org/docs/reference/functions/derivative.html
 */
export class MathService extends Effect.Service<MathService>()(
  "@repo/math/Math",
  {
    accessors: true,
    succeed: {
      compare,
      differentiate,
      evaluate,
      simplify,
    },
  }
) {}
