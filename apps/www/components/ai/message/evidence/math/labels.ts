import { Match, Schema } from "effect";

const ItemLabelKey = Schema.Literals([
  "math-item-algebraic-multiplicity",
  "math-item-approximation",
  "math-item-counterexample",
  "math-item-diagonalizable",
  "math-item-domain",
  "math-item-eigenbasis",
  "math-item-eigenvalue",
  "math-item-eigenvector",
  "math-item-factor",
  "math-item-geometric-multiplicity",
  "math-item-mode",
  "math-item-q1",
  "math-item-q2",
  "math-item-q3",
  "math-item-root",
  "math-item-solution",
  "math-item-singularity",
  "math-item-status",
  "math-item-result",
]);

const ItemValueKey = Schema.Literals([
  "math-value-no",
  "math-value-yes",
  "math-value-divergent",
]);

/** Maps math item labels to stable translation keys. */
export const getItemLabelKey = Match.type<string>().pipe(
  Match.withReturnType<typeof ItemLabelKey.Type>(),
  Match.when(
    "algebraic_multiplicity",
    () => "math-item-algebraic-multiplicity"
  ),
  Match.when("approximation", () => "math-item-approximation"),
  Match.when("counterexample", () => "math-item-counterexample"),
  Match.when("diagonalizable", () => "math-item-diagonalizable"),
  Match.when("domain", () => "math-item-domain"),
  Match.when("eigenbasis", () => "math-item-eigenbasis"),
  Match.when("eigenvalue", () => "math-item-eigenvalue"),
  Match.when("eigenvector", () => "math-item-eigenvector"),
  Match.when("factor", () => "math-item-factor"),
  Match.when(
    "geometric_multiplicity",
    () => "math-item-geometric-multiplicity"
  ),
  Match.when("mode", () => "math-item-mode"),
  Match.when("q1", () => "math-item-q1"),
  Match.when("q2", () => "math-item-q2"),
  Match.when("q3", () => "math-item-q3"),
  Match.when("root", () => "math-item-root"),
  Match.when("solution", () => "math-item-solution"),
  Match.when("singularity", () => "math-item-singularity"),
  Match.when("status", () => "math-item-status"),
  Match.orElse(() => "math-item-result")
);

/** Maps semantic math item values to localized display text. */
export function getItemValueKey(label: string, value: string) {
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
