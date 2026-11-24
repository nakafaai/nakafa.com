import { Schema } from "effect";

const KINDS = ["identical", "fraternal"] as const;
const KindSchema = Schema.Literals(KINDS);
export type Kind = typeof KindSchema.Type;

const ResultKeySchema = Schema.Literals([
  "same",
  "different",
  "either",
  "joined",
]);
export type ResultKey = typeof ResultKeySchema.Type;

const TwinOutcomeSchema = Schema.Struct({
  genes: ResultKeySchema,
  joined: Schema.Boolean,
  placentas: Schema.Finite,
  sacs: Schema.Finite,
  sex: ResultKeySchema,
});

type TwinOutcome = typeof TwinOutcomeSchema.Type;

/**
 * Determine placenta count, amniotic sac count, genetic identity, sex match,
 * and conjoined status from twin kind and split day after fertilisation:
 * - fraternal: always 2 placentas, 2 sacs, different genes, either sex
 * - identical day 0..3: 2 placentas, 2 sacs (dichorionic diamniotic)
 * - identical day 4..8: 1 shared placenta, 2 sacs (monochorionic diamniotic)
 * - identical day 9..12: 1 shared placenta, 1 shared sac (monoamniotic)
 * - identical day >= 13: incomplete embryonic disc split (conjoined twins)
 */
export function twinOutcome(kind: Kind, splitDay: number): TwinOutcome {
  if (kind === "fraternal") {
    return {
      genes: "different",
      joined: false,
      placentas: 2,
      sacs: 2,
      sex: "either",
    };
  }
  if (splitDay <= 3) {
    return {
      genes: "same",
      joined: false,
      placentas: 2,
      sacs: 2,
      sex: "same",
    };
  }
  if (splitDay <= 8) {
    return {
      genes: "same",
      joined: false,
      placentas: 1,
      sacs: 2,
      sex: "same",
    };
  }
  if (splitDay <= 12) {
    return {
      genes: "same",
      joined: false,
      placentas: 1,
      sacs: 1,
      sex: "same",
    };
  }
  return {
    genes: "same",
    joined: true,
    placentas: 1,
    sacs: 1,
    sex: "same",
  };
}
