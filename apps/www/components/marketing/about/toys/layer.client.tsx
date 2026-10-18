"use client";

import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Scatter, Toy, Toys } from "@repo/design-system/components/ui/toy";
import type { Place } from "@repo/design-system/lib/toy/scatter";
import type { ThingName } from "@repo/mascot/thing/name";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { HERO_NINA_ID } from "@/components/marketing/about/hero/id";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { TOY_HERD } from "@/components/marketing/about/toys/herd";
import { within } from "@/components/marketing/about/toys/place";

/** One toy: its place beside a part of the page, and the picture it is drawn as. */
export interface ToyPlacement {
  readonly key: string;
  readonly picture: ReactNode;
  readonly place: Place;
}

/** An animal of a herd at its index, drawn round at the size of a toy. */
export function ToyAnimal({
  herd,
  index,
}: {
  herd: typeof TOY_HERD;
  index: number;
}) {
  return (
    <PersonAvatar className="size-14" mascot={Arr.getUnsafe(herd, index)} />
  );
}

/** An animal of the home page's toys, at its index in the slice they take. */
function animal(index: number) {
  return <ToyAnimal herd={TOY_HERD} index={index} />;
}

/** A thing of Nina's world, drawn at the size of a toy. */
function thing(name: ThingName) {
  return <Thing name={name} />;
}

/**
 * The animals around the hero's title between two widths of the page, one for
 * each spot. A spot is the middle of the animal as fractions of the hero's box;
 * a spot at the top edge sits 20 px under it.
 */
function heroAnimals(
  minWidth: number,
  maxWidth: number,
  spots: readonly (readonly [number, number])[]
): ToyPlacement[] {
  return Arr.map(spots, ([x, y], index) => ({
    key: `hero-${minWidth}-${index}`,
    picture: animal(index),
    place: within("hero", {
      dx: -28,
      dy: y === 0 ? 20 : -28,
      maxWidth,
      minWidth,
      x,
      y,
    }),
  }));
}

/** Keeps a phone's spot of a thing inside the part, away from both edges. */
function inset(x: number) {
  return Math.min(0.88, Math.max(0.12, x));
}

/**
 * The small group of toys in the space where the part `part` begins, around
 * `x`, a fraction of the part's width: the animal at the herd's `index` in the
 * middle, and one or two things beside it. Each spot is in the part's top
 * padding, which no text or window reaches. From 1024 px the things sit close
 * to the animal; on a phone and a tablet, where a fraction is fewer pixels,
 * they sit further out, so every width keeps the whole group.
 */
function gap(
  part: string,
  x: number,
  index: number,
  things: readonly [ThingName] | readonly [ThingName, ThingName]
): ToyPlacement[] {
  const [before, after] = things;
  /** One thing beside the animal: close on a wide page, further out below 1024 px. */
  const beside = (name: ThingName, side: -1 | 1, dy: number) => [
    {
      key: `${part}-gap-${name}`,
      picture: thing(name),
      place: within(part, {
        dx: -24,
        dy,
        minWidth: 1024,
        x: x + side * 0.07,
        y: 0,
      }),
    },
    {
      key: `${part}-gap-${name}-narrow`,
      picture: thing(name),
      place: within(part, {
        dx: -24,
        dy,
        maxWidth: 1023,
        x: inset(x + side * 0.24),
        y: 0,
      }),
    },
  ];
  return [
    {
      key: `${part}-gap-animal`,
      picture: animal(index),
      place: within(part, { dx: -28, dy: 28, x, y: 0 }),
    },
    ...beside(before, -1, 40),
    ...(after === undefined ? [] : beside(after, 1, 20)),
  ];
}

/**
 * The toys of the home page: animals and things in the open space beside each
 * part. Each one has its own place, so it stays where its part puts it, and
 * none of them covers the text, a button or a window of the page.
 */
const PLACEMENTS: readonly ToyPlacement[] = [
  // Seven animals around the title from 1280 px, the widths with room on both
  // sides of it. Each spot is the middle of a 56 px animal.
  ...heroAnimals(1280, Number.POSITIVE_INFINITY, [
    [0.06, 0.1],
    [0.19, 0.25],
    [0.05, 0.47],
    [0.94, 0.09],
    [0.81, 0.27],
    [0.93, 0.46],
    [0.85, 0.68],
  ]),
  // Five on a tablet and a small laptop, kept to the outer columns, where the
  // title never reaches.
  ...heroAnimals(768, 1279, [
    [0.05, 0.12],
    [0.12, 0.42],
    [0.88, 0.1],
    [0.95, 0.36],
    [0.9, 0.64],
  ]),
  // Four in one row above the title on a phone.
  ...heroAnimals(0, 767, [
    [0.14, 0],
    [0.38, 0],
    [0.62, 0],
    [0.86, 0],
  ]),
  // Nina's things around her: what she reads with on her left, what she thinks
  // with on her right.
  {
    key: "hero-glasses",
    picture: thing("glasses"),
    place: within(HERO_NINA_ID, { minWidth: 768, x: -0.45, y: 0.12 }),
  },
  {
    key: "hero-book",
    picture: thing("book"),
    place: within(HERO_NINA_ID, { minWidth: 768, x: -0.3, y: 0.62 }),
  },
  {
    key: "hero-pencil",
    picture: thing("pencil"),
    place: within(HERO_NINA_ID, { minWidth: 768, x: 1.25, y: 0.1 }),
  },
  {
    key: "hero-bulb",
    picture: thing("bulb"),
    place: within(HERO_NINA_ID, { minWidth: 768, x: 1.1, y: 0.6 }),
  },
  // One small group in the space where each part begins: an animal with two
  // things that say what comes next, in turn in the middle, a little to the
  // left and a little to the right. A tablet keeps the animal alone.
  ...gap(LESSON_SECTION_ID, 0.5, 7, ["ruler", "highlighter"]),
  ...gap("tryout", 0.3, 8, ["stopwatch", "board"]),
  ...gap("nina", 0.7, 9, ["bubble", "magnifier"]),
  ...gap("memory", 0.5, 10, ["calendar"]),
  // The dark room of privacy holds its own: a key and a shield beside Nina,
  // and two animals keeping watch.
  {
    key: "privacy-key",
    picture: thing("key"),
    place: within("privacy", { minWidth: 1024, x: 0.1, y: 0.55 }),
  },
  {
    key: "privacy-shield",
    picture: thing("shield"),
    place: within("privacy", { minWidth: 1024, x: 0.86, y: 0.45 }),
  },
  {
    key: "privacy-left",
    picture: animal(11),
    place: within("privacy", { dy: 12, x: 0.06, y: 0 }),
  },
  {
    key: "privacy-right",
    picture: animal(12),
    place: within("privacy", { dy: -68, x: 0.86, y: 1 }),
  },
  ...gap("curricula", 0.3, 13, ["globe", "backpack"]),
  ...gap("letter", 0.7, 14, ["letter", "plane"]),
  {
    key: "letter-left",
    picture: animal(15),
    place: within("letter", { minWidth: 1100, x: 0.02, y: 0.3 }),
  },
  {
    key: "letter-right",
    picture: animal(16),
    place: within("letter", { minWidth: 1100, x: 0.94, y: 0.62 }),
  },
  ...gap("medals", 0.5, 17, ["cap", "medal"]),
  ...gap("pricing", 0.3, 18, ["donut", "calculator"]),
  ...gap("school", 0.7, 19, ["eraser", "flag"]),
  ...gap("faq", 0.5, 20, ["clip", "hourglass"]),
  ...gap("community", 0.3, 21, ["headphones", "coffee"]),
  ...gap("closing", 0.7, 22, ["trophy", "check"]),
];

/**
 * A layer of toys laid over a page that is already rendered, so the page never
 * moves when it mounts. It covers the nearest positioned parent, so a toy can be
 * carried from the top of the page to the footer, and `Scatter` puts each toy
 * where its place says at the current width of the page. The layer lets every
 * press through to the page, except on a toy.
 */
export function ToyOverlay({
  placements,
}: {
  placements: readonly ToyPlacement[];
}) {
  return (
    <Toys className="pointer-events-none absolute inset-0">
      <Scatter>
        {Arr.map(placements, (toy) => (
          <Toy key={toy.key} place={toy.place}>
            {toy.picture}
          </Toy>
        ))}
      </Scatter>
    </Toys>
  );
}

/** The layer of toys over the whole home page. */
export function HomeToyLayer() {
  return <ToyOverlay placements={PLACEMENTS} />;
}
