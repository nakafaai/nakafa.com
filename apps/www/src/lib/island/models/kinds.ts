import { Match, Schema } from "effect";
import { plantFaces, speciesFaces } from "@/lib/island/models/catalog";
import { Folk, folkFaces } from "@/lib/island/models/folk";
import { Swimmer, swimmerFaces } from "@/lib/island/models/ocean";
import { whaleFaces } from "@/lib/island/models/sea";
import { Stock, stockFaces } from "@/lib/island/models/stock";

/** Every body of the island's own that the world draws as a true 3D model (ADR 0047, D21). */
export const BodyKind = Schema.Literals([
  ...Folk.literals,
  ...Stock.literals,
  "whale",
]);
export type BodyKind = typeof BodyKind.Type;

/** A body's faces, built once a game. */
export function bodyFaces(kind: BodyKind) {
  return Match.value(kind).pipe(
    Match.when(Match.is(...Folk.literals), (folk) => folkFaces(folk)),
    Match.when(Match.is(...Stock.literals), (stock) => stockFaces(stock)),
    Match.orElse(whaleFaces)
  );
}

/**
 * Every model the world draws (ADR 0047, D21, D24 and D25): a body of the
 * island's own (the herd, the fox, the whale), a wild species of the catalog
 * by its index, a big swimmer of the open sea, or a plant of the catalog by
 * its index.
 */
export const Model = Schema.Union([
  Schema.TaggedStruct("body", { kind: BodyKind }),
  Schema.TaggedStruct("species", { index: Schema.Int }),
  Schema.TaggedStruct("swimmer", { kind: Swimmer }),
  Schema.TaggedStruct("plant", { index: Schema.Int }),
]);
export type Model = typeof Model.Type;

/** A model's faces, built the first time the world draws it. */
export function modelFaces(model: Model) {
  return Match.valueTags(model, {
    body: ({ kind }) => bodyFaces(kind),
    plant: ({ index }) => plantFaces(index),
    species: ({ index }) => speciesFaces(index),
    swimmer: ({ kind }) => swimmerFaces(kind),
  });
}

/** The one name the painter keeps a model's mesh under. */
export function modelKey(model: Model) {
  return Match.valueTags(model, {
    body: ({ kind }) => `body-${kind}`,
    plant: ({ index }) => `plant-${index}`,
    species: ({ index }) => `species-${index}`,
    swimmer: ({ kind }) => `swimmer-${kind}`,
  });
}
