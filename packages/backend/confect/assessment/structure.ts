import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Schema } from "effect";

/** One option, statement, or column: its identifier alone, the same in every language of its item. */
const Part = Schema.Struct({ id: Schema.String });

/** One statement or answer of a match: its identifier and how many pairs it may join. */
const Matched = Schema.Struct({ id: Schema.String, maxMatches: Schema.Int });

/**
 * What a grader reads of one interaction: its identifiers, counts, and bounds, never its words. Every
 * language version of an item shares it (the contract's `versionStructure`), so a place stores it once
 * and grades an answer the same in every language. A choice keeps its options and their bounds, a table
 * its statements and columns, a match its statements and answers with their limits, and a numeric entry
 * whether it accepts fractions. Every other kind keeps its identifier and kind, as the grader reads
 * nothing more of it. A full contract interaction is one, so School grades its own questions with the
 * same functions.
 */
export const InteractionStructure = Schema.Union([
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("choice"),
    maxChoices: Schema.Int,
    minChoices: Schema.Int,
    options: Schema.Array(Part),
    shuffle: Schema.Boolean,
  }),
  Schema.Struct({
    columns: Schema.Array(Part),
    id: Schema.String,
    kind: Schema.Literal("matrix"),
    shuffle: Schema.Boolean,
    statements: Schema.NonEmptyArray(Part),
  }),
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literal("match"),
    shuffle: Schema.Boolean,
    sources: Schema.NonEmptyArray(Matched),
    targets: Schema.NonEmptyArray(Matched),
  }),
  Schema.Struct({
    acceptsFractions: Schema.Boolean,
    id: Schema.String,
    kind: Schema.Literal("numericEntry"),
  }),
  Schema.Struct({
    id: Schema.String,
    kind: Schema.Literals([
      "extendedText",
      "gapMatch",
      "graphPoint",
      "hotspot",
      "inlineChoice",
      "mathEntry",
      "order",
      "sketch",
      "textEntry",
    ]),
  }),
]);
export type InteractionStructure = typeof InteractionStructure.Type;

/**
 * What the graders read: a structure a place stored, or a whole contract interaction, which holds
 * one, as School grades its live questions.
 */
export type GradedInteraction = InteractionStructure | Interaction;
