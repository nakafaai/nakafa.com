import { Match, Schema } from "effect";
import { Folk, folkFaces } from "@/lib/island/models/folk";
import { whaleFaces } from "@/lib/island/models/sea";
import { Stock, stockFaces } from "@/lib/island/models/stock";

/** Every body the world draws as a true 3D model (ADR 0047, D21). */
export const BodyKind = Schema.Literals([
  ...Folk.literals,
  ...Stock.literals,
  "whale",
]);
export type BodyKind = typeof BodyKind.Type;

/** A body's faces, built once a game. */
export function bodyFaces(kind: BodyKind) {
  return Match.value(kind).pipe(
    Match.when(Schema.is(Folk), folkFaces),
    Match.when(Schema.is(Stock), stockFaces),
    Match.orElse(whaleFaces)
  );
}
