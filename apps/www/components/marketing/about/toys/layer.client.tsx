"use client";

import { Animal } from "@repo/design-system/components/ui/animal";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Scatter, Toy, Toys } from "@repo/design-system/components/ui/toy";
import type { Place } from "@repo/design-system/lib/toy/scatter";
import type { ThingName } from "@repo/mascot/thing/name";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { TOY_HERD } from "@/components/marketing/about/toys/herd";
import { within } from "@/components/marketing/about/toys/place";

/** One toy: its place beside a part of the page, and the picture it is drawn as. */
interface ToyPlacement {
  readonly key: string;
  readonly picture: ReactNode;
  readonly place: Place;
}

/** An animal of the cast, at its index in the slice the toys take. */
function animal(index: number) {
  return <Animal className="size-14" mascot={Arr.getUnsafe(TOY_HERD, index)} />;
}

/** A thing of Nina's world, drawn at the size of a toy. */
function thing(name: ThingName) {
  return <Thing name={name} />;
}

/**
 * The toys of the home page: animals and things in the open space beside each
 * part. Each one has its own place, so it stays where its part puts it, and
 * none of them covers the text, a button or a window of the page.
 */
const PLACEMENTS: readonly ToyPlacement[] = [
  {
    key: "hero-left",
    picture: animal(0),
    place: within("hero", { minWidth: 1024, x: 0.005, y: 0.22 }),
  },
  {
    key: "hero-right",
    picture: animal(1),
    place: within("hero", { minWidth: 1024, x: 0.955, y: 0.2 }),
  },
  {
    key: "hero-low",
    picture: animal(2),
    place: within("hero", { minWidth: 1024, x: 0.01, y: 0.72 }),
  },
  {
    key: "hero-book",
    picture: thing("book"),
    place: within("hero", { minWidth: 1024, x: 0.5, y: 0.86 }),
  },
  {
    key: "hero-top-1",
    picture: animal(3),
    place: within("hero", { maxWidth: 767, x: 0.08, y: 0.03 }),
  },
  {
    key: "hero-top-2",
    picture: animal(4),
    place: within("hero", { maxWidth: 767, x: 0.36, y: 0 }),
  },
  {
    key: "hero-top-3",
    picture: animal(5),
    place: within("hero", { maxWidth: 767, x: 0.64, y: 0.03 }),
  },
  {
    key: "hero-top-4",
    picture: animal(6),
    place: within("hero", { maxWidth: 767, x: 0.86, y: 0 }),
  },
  {
    key: "lesson-gap",
    picture: animal(7),
    place: within("lesson", { dy: -30, minWidth: 1024, x: 0.97, y: 0 }),
  },
  {
    key: "tryout-gap",
    picture: thing("stopwatch"),
    place: within("tryout", { dy: -30, minWidth: 1024, x: 0.03, y: 0 }),
  },
  {
    key: "nina-gap",
    picture: animal(8),
    place: within("nina", { dy: -30, minWidth: 1024, x: 0.96, y: 0 }),
  },
  {
    key: "memory-gap",
    picture: thing("calendar"),
    place: within("memory", { dy: -30, minWidth: 1024, x: 0.04, y: 0 }),
  },
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
    picture: animal(9),
    place: within("privacy", { minWidth: 1024, x: 0.04, y: 0.2 }),
  },
  {
    key: "privacy-right",
    picture: animal(10),
    place: within("privacy", { minWidth: 1024, x: 0.9, y: 0.8 }),
  },
  {
    key: "curricula-gap",
    picture: thing("globe"),
    place: within("curricula", { dy: -30, minWidth: 1024, x: 0.03, y: 0 }),
  },
  {
    key: "curricula-animal",
    picture: animal(11),
    place: within("curricula", { dy: -30, minWidth: 1024, x: 0.97, y: 0 }),
  },
  {
    key: "letter-left",
    picture: animal(12),
    place: within("letter", { minWidth: 1100, x: 0.02, y: 0.1 }),
  },
  {
    key: "letter-right",
    picture: animal(13),
    place: within("letter", { minWidth: 1100, x: 0.96, y: 0.7 }),
  },
  {
    key: "medals-medal",
    picture: thing("medal"),
    place: within("medals", { minWidth: 1024, x: 0.02, y: 0.12 }),
  },
  {
    key: "pricing-donut",
    picture: thing("donut"),
    place: within("pricing", { minWidth: 1024, x: 0.94, y: 0.1 }),
  },
  {
    key: "pricing-calculator",
    picture: thing("calculator"),
    place: within("pricing", { minWidth: 1024, x: 0.04, y: 0.8 }),
  },
  {
    key: "school-animal",
    picture: animal(14),
    place: within("school", { minWidth: 1024, x: 0.01, y: 0.12 }),
  },
  {
    key: "faq-clip",
    picture: thing("clip"),
    place: within("faq", { minWidth: 1024, x: 0.97, y: 0.1 }),
  },
  {
    key: "community-animal",
    picture: animal(15),
    place: within("community", { minWidth: 1024, x: 0.02, y: 0.82 }),
  },
  {
    key: "closing-animal",
    picture: animal(16),
    place: within("closing", { minWidth: 1024, x: 0.96, y: 0.1 }),
  },
];

/**
 * The layer of toys over the whole home page. The page sits inside `Toys`, so a
 * toy can be carried from the hero to the footer, and `Scatter` puts each toy
 * where its place says at the current width of the page.
 */
export function HomeToys({ children }: { children: ReactNode }) {
  return (
    <Toys>
      {children}
      <Scatter>
        {Arr.map(PLACEMENTS, (toy) => (
          <Toy key={toy.key} place={toy.place}>
            {toy.picture}
          </Toy>
        ))}
      </Scatter>
    </Toys>
  );
}
