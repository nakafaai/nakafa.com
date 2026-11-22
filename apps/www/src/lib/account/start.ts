import { Schema } from "effect";

/** A country that holds try-outs, by its flag's code and its name. */
const TryoutCountry = Schema.Struct({
  countryCode: Schema.String,
  title: Schema.String,
});

/**
 * What a learner who has sat no try-out yet can start: the exams of the country they last picked on the
 * try-out page, with its page, or every country that holds try-outs when they picked none.
 */
export const TryoutStart = Schema.Union([
  Schema.Struct({
    country: Schema.Struct({
      ...TryoutCountry.fields,
      publicPath: Schema.String,
    }),
    exams: Schema.Array(
      Schema.Struct({ examKey: Schema.String, title: Schema.String })
    ),
    kind: Schema.Literal("country"),
  }),
  Schema.Struct({
    countries: Schema.Array(TryoutCountry),
    kind: Schema.Literal("countries"),
  }),
]);
export type TryoutStart = typeof TryoutStart.Type;
