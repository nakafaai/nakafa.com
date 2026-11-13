import { Array as Arr } from "effect";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import { gap } from "@/components/marketing/about/toys/gap";
import {
  ToyOverlay,
  type ToyPlacement,
} from "@/components/marketing/about/toys/layer";
import { NinaToy } from "@/components/marketing/about/toys/nina";
import { within } from "@/components/marketing/about/toys/place";
import {
  SCHOOL_PRICING_HERD,
  SCHOOL_TOY_HERD,
} from "@/components/marketing/school/features/cast";
import { SCHOOL_NINA_ID } from "@/components/marketing/school/hero/id";

/**
 * The spots of the animals around the hero's title, as fractions of the hero's
 * box, each with the width it starts at: the outer four stand from 1024 px, and
 * the inner two from 1280 px, where the title leaves them room.
 */
const HERO_SPOTS = [
  { minWidth: 1024, x: 0.06, y: 0.2 },
  { minWidth: 1024, x: 0.94, y: 0.24 },
  { minWidth: 1280, x: 0.12, y: 0.5 },
  { minWidth: 1280, x: 0.88, y: 0.54 },
  { minWidth: 1024, x: 0.08, y: 0.82 },
  { minWidth: 1024, x: 0.92, y: 0.8 },
] as const;

/**
 * The toys of the School landing: six animals around the hero's title, and a
 * small herd with its things where each centred part begins, every thing one a
 * school keeps. The animals come after the people of the demos in one cast, so
 * no animal appears twice on the page.
 */
const PLACEMENTS: readonly ToyPlacement[] = [
  ...Arr.map(HERO_SPOTS, ({ minWidth, x, y }, index) => ({
    key: `hero-${index}`,
    picture: <ToyAnimal herd={SCHOOL_TOY_HERD} index={index} />,
    place: within("hero", { dx: -28, dy: -28, minWidth, x, y }),
  })),
  ...gap("class", 0.5, SCHOOL_TOY_HERD, [6, 7], ["backpack", "book"]),
  ...gap("exams", 0.5, SCHOOL_TOY_HERD, [8, 9], ["hourglass", "calculator"]),
  ...gap("player", 0.5, SCHOOL_TOY_HERD, [16, 17], ["glasses", "bulb"]),
  ...gap("year", 0.5, SCHOOL_TOY_HERD, [10, 11], ["cap", "trophy"]),
  ...gap("faq", 0.5, SCHOOL_TOY_HERD, [12, 13], ["bubble", "magnifier"]),
  ...gap("closing", 0.5, SCHOOL_TOY_HERD, [14, 15], ["medal", "flag"]),
];

/**
 * The toys of the School pricing page: an animal in each top corner above the
 * plans' title, and a small herd with its things where each later part begins.
 */
const PRICING_PLACEMENTS: readonly ToyPlacement[] = [
  {
    key: "plans-start",
    picture: <ToyAnimal herd={SCHOOL_PRICING_HERD} index={0} />,
    place: within("plans", { dx: -28, dy: 96, minWidth: 1024, x: 0.08, y: 0 }),
  },
  {
    key: "plans-end",
    picture: <ToyAnimal herd={SCHOOL_PRICING_HERD} index={1} />,
    place: within("plans", { dx: -28, dy: 132, minWidth: 1024, x: 0.92, y: 0 }),
  },
  ...gap("compare", 0.5, SCHOOL_PRICING_HERD, [2, 3], ["calculator", "clip"]),
  ...gap("accounts", 0.5, SCHOOL_PRICING_HERD, [4, 5], ["backpack", "pencil"]),
  ...gap("addons", 0.5, SCHOOL_PRICING_HERD, [6, 7], ["globe", "bulb"]),
  ...gap("faq", 0.5, SCHOOL_PRICING_HERD, [8, 9], ["bubble", "note"]),
  ...gap("closing", 0.5, SCHOOL_PRICING_HERD, [10, 11], ["medal", "flag"]),
];

/** The layer of toys over the School pricing page. */
export function SchoolPricingToys() {
  return <ToyOverlay placements={PRICING_PLACEMENTS} />;
}

/**
 * The layer of toys over the School landing: its animals and things, and every
 * Nina of its parts, each of whom can be carried anywhere on the page.
 */
export function SchoolToys() {
  return (
    <ToyOverlay placements={PLACEMENTS}>
      <NinaToy act="teaching" size={240} slot={SCHOOL_NINA_ID} />
      <NinaToy act="typing" size={88} slot="forum-nina" />
      <NinaToy act="carrying" size={88} slot="class-nina" />
      <NinaToy act="thinking" size={88} slot="exams-nina" />
      <NinaToy act="writing" size={88} slot="player-nina" />
      <NinaToy act="graduating" size={88} slot="year-nina" />
    </ToyOverlay>
  );
}
