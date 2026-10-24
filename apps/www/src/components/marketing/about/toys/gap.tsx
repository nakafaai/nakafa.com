import { Thing } from "@repo/design-system/components/ui/thing";
import type { ThingName } from "@repo/mascot/thing/name";
import { Array as Arr, Match } from "effect";
import type { ReactNode } from "react";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import type { TOY_HERD } from "@/components/marketing/about/toys/herd";
import type { ToyPlacement } from "@/components/marketing/about/toys/layer";
import { within } from "@/components/marketing/about/toys/place";
import {
  type GapPicture,
  gapSpots,
} from "@/components/marketing/about/toys/spot";

/** A thing of Nina's world, drawn at the size of a toy. */
export function thing(name: ThingName) {
  return <Thing name={name} />;
}

/** Draws one spot of a gap: an animal of the herd at its index, or a thing. */
function drawPicture(herd: typeof TOY_HERD, picture: GapPicture): ReactNode {
  return Match.value(picture).pipe(
    Match.discriminatorsExhaustive("kind")({
      animal: ({ index }) => <ToyAnimal herd={herd} index={index} />,
      thing: ({ name }) => thing(name),
    })
  );
}

/**
 * The small herd in the space where the part `part` begins, drawn as toys. The
 * spots and their pictures are set by `gapSpots`, and each place is `within` the part.
 */
export function gap(
  part: string,
  x: number,
  herd: typeof TOY_HERD,
  animals: readonly [number, number],
  things: readonly [ThingName] | readonly [ThingName, ThingName]
): ToyPlacement[] {
  return Arr.map(gapSpots(part, x, animals, things), (spot) => ({
    key: spot.key,
    picture: drawPicture(herd, spot.picture),
    place: within(part, spot.anchor),
  }));
}
