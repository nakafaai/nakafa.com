import { Schema } from "effect";

const CondensationPolymerSchema = Schema.Literals(["nylon66", "terylene"]);

export type CondensationPolymer = typeof CondensationPolymerSchema.Type;

const CondensationProfileSchema = Schema.Struct({
  isAmide: Schema.Boolean,
  linkLabel: Schema.String,
});

/** Distinguish polyamide (nylon-6,6) vs polyester (terylene) condensation linkages. */
export function evaluateCondensationPolymer(
  polymer: CondensationPolymer
): typeof CondensationProfileSchema.Type {
  if (polymer === "nylon66") {
    return {
      isAmide: true,
      linkLabel: "-CONH-",
    };
  }
  return {
    isAmide: false,
    linkLabel: "-COO-",
  };
}
