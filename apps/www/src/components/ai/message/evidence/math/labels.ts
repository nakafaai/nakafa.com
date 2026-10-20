import type { MathItem } from "@repo/math/schema/shared";
import { Match, Schema } from "effect";

const ItemValueKey = Schema.Literals([
  "math-value-no",
  "math-value-yes",
  "math-value-divergent",
]);

/**
 * The translation key of each math item label. Every label has one, so a new
 * label fails the typecheck here until it has one.
 */
const ITEM_LABEL_KEYS = {
  algebraic_multiplicity: "math-item-algebraic-multiplicity",
  approximation: "math-item-approximation",
  counterexample: "math-item-counterexample",
  diagonalizable: "math-item-diagonalizable",
  domain: "math-item-domain",
  eigenbasis: "math-item-eigenbasis",
  eigenvalue: "math-item-eigenvalue",
  eigenvector: "math-item-eigenvector",
  factor: "math-item-factor",
  geometric_multiplicity: "math-item-geometric-multiplicity",
  mode: "math-item-mode",
  q1: "math-item-q1",
  q2: "math-item-q2",
  q3: "math-item-q3",
  root: "math-item-root",
  singularity: "math-item-singularity",
  solution: "math-item-solution",
  status: "math-item-status",
} as const satisfies Record<MathItem["label"], string>;

/** Maps math item labels to stable translation keys. */
export function getItemLabelKey(label: MathItem["label"]) {
  return ITEM_LABEL_KEYS[label];
}

/** Maps semantic math item values to localized display text. */
export function getItemValueKey(label: MathItem["label"], value: string) {
  if (label === "diagonalizable") {
    return Match.value(value).pipe(
      Match.withReturnType<typeof ItemValueKey.Type | undefined>(),
      Match.when("false", () => "math-value-no"),
      Match.when("true", () => "math-value-yes"),
      Match.orElse(() => undefined)
    );
  }

  if (label === "status") {
    return Match.value(value).pipe(
      Match.withReturnType<typeof ItemValueKey.Type | undefined>(),
      Match.when("divergent", () => "math-value-divergent"),
      Match.orElse(() => undefined)
    );
  }
}
