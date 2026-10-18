import { Thing } from "@repo/design-system/components/ui/thing";
import type { ThingName } from "@repo/mascot/thing/name";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import type { TOY_HERD } from "@/components/marketing/about/toys/herd";
import type { ToyPlacement } from "@/components/marketing/about/toys/layer.client";
import { within } from "@/components/marketing/about/toys/place";

/** A thing of Nina's world, drawn at the size of a toy. */
export function thing(name: ThingName) {
  return <Thing name={name} />;
}

/** Keeps a phone's spot of a toy inside the part, away from both edges. */
function inset(x: number) {
  return Math.min(0.88, Math.max(0.12, x));
}

/**
 * The small herd in the space where the part `part` begins, around `x`, a
 * fraction of the part's width: two animals of `herd`, the first at `x` and the
 * second toward the middle of the page, with one or two things beside them that
 * say what comes next. Their heights differ a little, so the herd stands loosely.
 * Each spot is in the part's top padding, which no text or window reaches. From
 * 1024 px the herd stands close together; on a phone and a tablet, where a
 * fraction is fewer pixels, the things sit further out and the second animal
 * stands at the far side, so every width keeps the whole herd.
 */
export function gap(
  part: string,
  x: number,
  herd: typeof TOY_HERD,
  animals: readonly [number, number],
  things: readonly [ThingName] | readonly [ThingName, ThingName]
): ToyPlacement[] {
  const [first, second] = animals;
  const [before, after] = things;
  const side = x <= 0.5 ? 1 : -1;
  const animalAt = (
    name: string,
    index: number,
    spot: { dy: number; maxWidth?: number; minWidth?: number; x: number }
  ) => ({
    key: `${part}-gap-${name}`,
    picture: <ToyAnimal herd={herd} index={index} />,
    place: within(part, { dx: -28, ...spot, y: 0 }),
  });
  const thingAt = (
    name: ThingName,
    spot: { dy: number; maxWidth?: number; minWidth?: number; x: number }
  ) => ({
    key: `${part}-gap-${name}-${spot.minWidth === undefined ? "narrow" : "wide"}`,
    picture: thing(name),
    place: within(part, { dx: -24, ...spot, y: 0 }),
  });
  return [
    animalAt("animal", first, { dy: 28, x }),
    animalAt("second-wide", second, {
      dy: 40,
      minWidth: 1024,
      x: x + side * 0.16,
    }),
    animalAt("second-narrow", second, {
      dy: 40,
      maxWidth: 1023,
      x: side === 1 ? 0.88 : 0.12,
    }),
    thingAt(before, { dy: 40, minWidth: 1024, x: x - side * 0.07 }),
    thingAt(before, { dy: 40, maxWidth: 1023, x: inset(x - side * 0.2) }),
    ...(after === undefined
      ? []
      : [
          thingAt(after, { dy: 20, minWidth: 1024, x: x + side * 0.08 }),
          thingAt(after, { dy: 20, maxWidth: 1023, x: inset(x + side * 0.2) }),
        ]),
  ];
}
