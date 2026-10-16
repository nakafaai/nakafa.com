"use client";

import { Thing } from "@repo/design-system/components/ui/thing";
import { Scatter, Toy, Toys } from "@repo/design-system/components/ui/toy";
import type { Place } from "@repo/design-system/lib/toy/scatter";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { CastAnimal } from "@/components/marketing/about/cast";
import { TOY_HERD } from "@/components/marketing/about/toys/herd";
import { within } from "@/components/marketing/about/toys/place";

/** One toy: its place beside a part of the page, and the picture it is drawn as. */
export interface ToyPlacement {
  readonly key: string;
  readonly picture: ReactNode;
  readonly place: Place;
}

/** An animal of a herd at its index, drawn at the size of a toy. */
export function ToyAnimal({
  herd,
  index,
}: {
  herd: typeof TOY_HERD;
  index: number;
}) {
  return <CastAnimal className="size-14" mascot={Arr.getUnsafe(herd, index)} />;
}

/**
 * The toys of the home page: animals and things in the open space beside each
 * part. Each one has its own place, so it stays where its part puts it, and
 * none of them covers the text, a button or a window of the page.
 */
const PLACEMENTS: readonly ToyPlacement[] = [
  {
    key: "hero-left",
    picture: <ToyAnimal herd={TOY_HERD} index={0} />,
    place: within("hero", { minWidth: 1024, x: 0.005, y: 0.22 }),
  },
  {
    key: "hero-right",
    picture: <ToyAnimal herd={TOY_HERD} index={1} />,
    place: within("hero", { minWidth: 1024, x: 0.955, y: 0.2 }),
  },
  {
    key: "hero-low",
    picture: <ToyAnimal herd={TOY_HERD} index={2} />,
    place: within("hero", { minWidth: 1024, x: 0.01, y: 0.72 }),
  },
  {
    key: "hero-book",
    picture: <Thing name="book" />,
    place: within("hero", { minWidth: 1024, x: 0.5, y: 0.86 }),
  },
  {
    key: "hero-top-1",
    picture: <ToyAnimal herd={TOY_HERD} index={3} />,
    place: within("hero", { maxWidth: 767, x: 0.08, y: 0.03 }),
  },
  {
    key: "hero-top-2",
    picture: <ToyAnimal herd={TOY_HERD} index={4} />,
    place: within("hero", { maxWidth: 767, x: 0.36, y: 0 }),
  },
  {
    key: "hero-top-3",
    picture: <ToyAnimal herd={TOY_HERD} index={5} />,
    place: within("hero", { maxWidth: 767, x: 0.64, y: 0.03 }),
  },
  {
    key: "hero-top-4",
    picture: <ToyAnimal herd={TOY_HERD} index={6} />,
    place: within("hero", { maxWidth: 767, x: 0.86, y: 0 }),
  },
  {
    key: "lesson-gap",
    picture: <ToyAnimal herd={TOY_HERD} index={7} />,
    place: within("lesson", { dy: -30, minWidth: 1024, x: 0.97, y: 0 }),
  },
  {
    key: "tryout-gap",
    picture: <Thing name="stopwatch" />,
    place: within("tryout", { dy: -30, minWidth: 1024, x: 0.03, y: 0 }),
  },
  {
    key: "nina-gap",
    picture: <ToyAnimal herd={TOY_HERD} index={8} />,
    place: within("nina", { dy: -30, minWidth: 1024, x: 0.96, y: 0 }),
  },
  {
    key: "memory-gap",
    picture: <Thing name="calendar" />,
    place: within("memory", { dy: -30, minWidth: 1024, x: 0.04, y: 0 }),
  },
  {
    key: "privacy-key",
    picture: <Thing name="key" />,
    place: within("privacy", { minWidth: 1024, x: 0.1, y: 0.55 }),
  },
  {
    key: "privacy-shield",
    picture: <Thing name="shield" />,
    place: within("privacy", { minWidth: 1024, x: 0.86, y: 0.45 }),
  },
  {
    key: "privacy-left",
    picture: <ToyAnimal herd={TOY_HERD} index={9} />,
    place: within("privacy", { minWidth: 1024, x: 0.04, y: 0.2 }),
  },
  {
    key: "privacy-right",
    picture: <ToyAnimal herd={TOY_HERD} index={10} />,
    place: within("privacy", { minWidth: 1024, x: 0.9, y: 0.8 }),
  },
  {
    key: "curricula-gap",
    picture: <Thing name="globe" />,
    place: within("curricula", { dy: -30, minWidth: 1024, x: 0.03, y: 0 }),
  },
  {
    key: "curricula-animal",
    picture: <ToyAnimal herd={TOY_HERD} index={11} />,
    place: within("curricula", { dy: -30, minWidth: 1024, x: 0.97, y: 0 }),
  },
  {
    key: "letter-left",
    picture: <ToyAnimal herd={TOY_HERD} index={12} />,
    place: within("letter", { minWidth: 1100, x: 0.02, y: 0.1 }),
  },
  {
    key: "letter-right",
    picture: <ToyAnimal herd={TOY_HERD} index={13} />,
    place: within("letter", { minWidth: 1100, x: 0.96, y: 0.7 }),
  },
  {
    key: "medals-medal",
    picture: <Thing name="medal" />,
    place: within("medals", { minWidth: 1024, x: 0.02, y: 0.12 }),
  },
  {
    key: "pricing-donut",
    picture: <Thing name="donut" />,
    place: within("pricing", { minWidth: 1024, x: 0.94, y: 0.1 }),
  },
  {
    key: "pricing-calculator",
    picture: <Thing name="calculator" />,
    place: within("pricing", { minWidth: 1024, x: 0.04, y: 0.8 }),
  },
  {
    key: "school-animal",
    picture: <ToyAnimal herd={TOY_HERD} index={14} />,
    place: within("school", { minWidth: 1024, x: 0.01, y: 0.12 }),
  },
  {
    key: "faq-clip",
    picture: <Thing name="clip" />,
    place: within("faq", { minWidth: 1024, x: 0.97, y: 0.1 }),
  },
  {
    key: "community-animal",
    picture: <ToyAnimal herd={TOY_HERD} index={15} />,
    place: within("community", { minWidth: 1024, x: 0.02, y: 0.82 }),
  },
  {
    key: "closing-animal",
    picture: <ToyAnimal herd={TOY_HERD} index={16} />,
    place: within("closing", { minWidth: 1024, x: 0.96, y: 0.1 }),
  },
];

/** The scattered toys of a page: each one put where its place says at this width. */
function ScatteredToys({
  placements,
}: {
  placements: readonly ToyPlacement[];
}) {
  return (
    <Scatter>
      {Arr.map(placements, (toy) => (
        <Toy key={toy.key} place={toy.place}>
          {toy.picture}
        </Toy>
      ))}
    </Scatter>
  );
}

/**
 * A layer of toys over a whole page. The page sits inside `Toys`, so a toy can
 * be carried from the top of the page to the footer, and `Scatter` puts each
 * toy where its place says at the current width of the page.
 */
function ToyLayer({
  children,
  placements,
}: {
  children: ReactNode;
  placements: readonly ToyPlacement[];
}) {
  return (
    <Toys>
      {children}
      <ScatteredToys placements={placements} />
    </Toys>
  );
}

/**
 * A layer of toys laid over a page that is already rendered, so the page never
 * moves when it mounts. It covers the nearest positioned parent and lets every
 * press through to the page, except on a toy.
 */
export function ToyOverlay({
  placements,
}: {
  placements: readonly ToyPlacement[];
}) {
  return (
    <Toys className="pointer-events-none absolute inset-0">
      <ScatteredToys placements={placements} />
    </Toys>
  );
}

/** The layer of toys over the whole home page. */
export function HomeToys({ children }: { children: ReactNode }) {
  return <ToyLayer placements={PLACEMENTS}>{children}</ToyLayer>;
}
