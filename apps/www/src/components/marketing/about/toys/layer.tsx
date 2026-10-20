"use client";

import { Scatter, Toy, Toys } from "@repo/design-system/components/ui/toy";
import type { Place } from "@repo/design-system/lib/toy/scatter";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { HERO_NINA_ID } from "@/components/marketing/about/hero/id";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import { gap, thing } from "@/components/marketing/about/toys/gap";
import { SPARE_HERD, TOY_HERD } from "@/components/marketing/about/toys/herd";
import { NinaToy } from "@/components/marketing/about/toys/nina";
import { within } from "@/components/marketing/about/toys/place";
import { NINA_SLOT } from "@/components/marketing/about/toys/slot";

/** One toy: its place beside a part of the page, and the picture it is drawn as. */
export interface ToyPlacement {
  readonly key: string;
  readonly picture: ReactNode;
  readonly place: Place;
}

/** An animal of the home page's toys, at its index in the slice they take. */
function animal(index: number) {
  return <ToyAnimal herd={TOY_HERD} index={index} />;
}

/** An animal the page keeps for its sparse parts, at its index in that slice. */
function spare(index: number) {
  return <ToyAnimal herd={SPARE_HERD} index={index} />;
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
  // A small herd in the space where each part begins: two animals with the
  // things that say what comes next, in turn in the middle, a little to the
  // left and a little to the right.
  ...gap(LESSON_SECTION_ID, 0.5, TOY_HERD, [7, 23], ["ruler", "highlighter"]),
  ...gap("tryout", 0.3, TOY_HERD, [8, 24], ["stopwatch", "board"]),
  ...gap("nina", 0.7, TOY_HERD, [9, 25], ["bubble", "magnifier"]),
  ...gap("memory", 0.5, TOY_HERD, [10, 26], ["calendar"]),
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
  // A padlock beside the room from 1024 px; every other thing of Nina's world
  // already stands somewhere on the page, and none appears twice.
  {
    key: "privacy-padlock",
    picture: thing("padlock"),
    place: within("privacy", { minWidth: 1024, x: 0.12, y: 0.22 }),
  },
  ...gap("curricula", 0.3, TOY_HERD, [13, 27], ["globe", "backpack"]),
  ...gap("letter", 0.7, TOY_HERD, [14, 28], ["letter", "plane"]),
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
  ...gap("medals", 0.5, TOY_HERD, [17, 29], ["cap", "medal"]),
  ...gap("pricing", 0.3, TOY_HERD, [18, 30], ["donut", "calculator"]),
  ...gap("school", 0.7, TOY_HERD, [19, 31], ["eraser", "flag"]),
  ...gap("faq", 0.5, TOY_HERD, [20, 32], ["clip", "hourglass"]),
  ...gap("community", 0.3, TOY_HERD, [21, 33], ["headphones", "coffee"]),
  ...gap("closing", 0.7, TOY_HERD, [22, 34], ["trophy", "check"]),
  // The sparse parts take the spare animals and a note on the memory desk: the
  // desk at its sides from 1024 px and below it, the school band and the closing
  // question below them. Each stands in the part's padding or beside its column,
  // where no text or control reaches, and no thing appears twice on the page.
  {
    key: "memory-left-animal",
    picture: spare(0),
    place: within("memory", {
      dx: -28,
      dy: -28,
      minWidth: 1024,
      x: 0.08,
      y: 0.42,
    }),
  },
  {
    key: "memory-left-note",
    picture: thing("note"),
    place: within("memory", {
      dx: -24,
      dy: -24,
      minWidth: 1024,
      x: 0.14,
      y: 0.68,
    }),
  },
  {
    key: "memory-right-animal",
    picture: spare(1),
    place: within("memory", {
      dx: -28,
      dy: -28,
      minWidth: 1024,
      x: 0.92,
      y: 0.3,
    }),
  },
  {
    key: "memory-below-animal",
    picture: spare(2),
    place: within("memory", { dx: -28, dy: -68, x: 0.5, y: 1 }),
  },
  {
    key: "school-below-animal",
    picture: spare(3),
    place: within("school", { dx: -28, dy: -68, x: 0.3, y: 1 }),
  },
  {
    key: "closing-below-animal",
    picture: spare(4),
    place: within("closing", { dx: -28, dy: -68, x: 0.18, y: 1 }),
  },
];

/**
 * A layer of toys laid over a page that is already rendered, so the page never
 * moves when it mounts. It covers the nearest positioned parent, so a toy can be
 * carried from the top of the page to the footer, and `Scatter` puts each toy
 * where its place says at the current width of the page. The layer lets every
 * press through to the page, except on a toy, and clips a toy at the page's
 * edges, so a toy placed or carried there never makes the page scroll sideways.
 */
export function ToyOverlay({
  children,
  placements,
}: {
  /** Toys of the page that place themselves, such as a Nina that can be carried. */
  children?: ReactNode;
  placements: readonly ToyPlacement[];
}) {
  return (
    <Toys className="pointer-events-none absolute inset-0 overflow-clip">
      <Scatter>
        {Arr.map(placements, (toy) => (
          <Toy key={toy.key} place={toy.place}>
            {toy.picture}
          </Toy>
        ))}
        {children}
      </Scatter>
    </Toys>
  );
}

/**
 * The layer of toys over the whole home page: the animals and things, and every
 * Nina of the page, each of whom can be carried anywhere on it.
 */
export function HomeToyLayer() {
  return (
    <ToyOverlay placements={PLACEMENTS}>
      <NinaToy act="reading" size={240} slot={HERO_NINA_ID} />
      <NinaToy act="waving" size={88} slot={NINA_SLOT.lesson} />
      <NinaToy act="typing" size={88} slot={NINA_SLOT.nina} />
      <NinaToy act="pointing" size={200} slot={NINA_SLOT.curricula} />
      <NinaToy act="juggling" size={240} slot={NINA_SLOT.closing} />
    </ToyOverlay>
  );
}
