import { Thing } from "@repo/backend/confect/island/things";
import { Match, Schema } from "effect";
import { bobberFaces } from "@/lib/island/models/bobber";
import { flyerFaces, speciesFaces } from "@/lib/island/models/catalog";
import { Folk, folkFaces } from "@/lib/island/models/folk";
import { Fruit, fruitFaces } from "@/lib/island/models/fruit";
import { Swimmer, swimmerFaces } from "@/lib/island/models/ocean";
import { ReefKind, reefFaces } from "@/lib/island/models/reef";
import { whaleFaces } from "@/lib/island/models/sea";
import { Stock, stockFaces } from "@/lib/island/models/stock";
import { tackleFaces } from "@/lib/island/models/tackle";
import { thingFaces } from "@/lib/island/models/things";

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
 * by its index, a species of the sky on the wing (D49), a big swimmer of the
 * open sea, one look of a kind of reef life (D50), one look of a thing a
 * learner builds or a wild plant (ADR 0050, W2), the rod of a villager who
 * fishes (D54), the float of the learner's own line (D15), or a fruit a
 * shaken tree dropped (W2).
 */
export const Model = Schema.Union([
  Schema.TaggedStruct("body", { kind: BodyKind }),
  Schema.TaggedStruct("species", { index: Schema.Int }),
  Schema.TaggedStruct("flyer", { index: Schema.Int }),
  Schema.TaggedStruct("swimmer", { kind: Swimmer }),
  Schema.TaggedStruct("reef", { kind: ReefKind, look: Schema.Int }),
  Schema.TaggedStruct("thing", { kind: Thing, look: Schema.Int }),
  Schema.TaggedStruct("tackle", {}),
  Schema.TaggedStruct("bobber", {}),
  Schema.TaggedStruct("fruit", { kind: Fruit }),
]);
export type Model = typeof Model.Type;

/** A model's faces, built the first time the world draws it. */
export function modelFaces(model: Model) {
  return Match.valueTags(model, {
    bobber: bobberFaces,
    body: ({ kind }) => bodyFaces(kind),
    flyer: ({ index }) => flyerFaces(index),
    fruit: ({ kind }) => fruitFaces(kind),
    reef: ({ kind, look }) => reefFaces(kind, look),
    species: ({ index }) => speciesFaces(index),
    swimmer: ({ kind }) => swimmerFaces(kind),
    tackle: tackleFaces,
    thing: ({ kind, look }) => thingFaces(kind, look),
  });
}

/** The one name the painter keeps a model's mesh under. */
export function modelKey(model: Model) {
  return Match.valueTags(model, {
    bobber: () => "bobber",
    body: ({ kind }) => `body-${kind}`,
    flyer: ({ index }) => `flyer-${index}`,
    fruit: ({ kind }) => `fruit-${kind}`,
    reef: ({ kind, look }) => `reef-${kind}-${look}`,
    species: ({ index }) => `species-${index}`,
    swimmer: ({ kind }) => `swimmer-${kind}`,
    tackle: () => "tackle",
    thing: ({ kind, look }) => `thing-${kind}-${look}`,
  });
}
