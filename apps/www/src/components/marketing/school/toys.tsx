import { Array as Arr } from "effect";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import { gap } from "@/components/marketing/about/toys/gap";
import {
  ToyOverlay,
  type ToyPlacement,
} from "@/components/marketing/about/toys/layer";
import { NinaToy } from "@/components/marketing/about/toys/nina";
import { within } from "@/components/marketing/about/toys/place";
import { SCHOOL_TOY_HERD } from "@/components/marketing/school/features/cast";
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
  ...gap("tasks", 0.5, SCHOOL_TOY_HERD, [6, 7], ["backpack", "ruler"]),
  ...gap("exams", 0.5, SCHOOL_TOY_HERD, [8, 9], ["hourglass", "calculator"]),
  ...gap("graduation", 0.5, SCHOOL_TOY_HERD, [10, 11], ["cap", "trophy"]),
  ...gap("faq", 0.5, SCHOOL_TOY_HERD, [12, 13], ["bubble", "magnifier"]),
  ...gap("closing", 0.5, SCHOOL_TOY_HERD, [14, 15], ["medal", "flag"]),
];

/**
 * The layer of toys over the School landing: its animals and things, and every
 * Nina of its parts, each of whom can be carried anywhere on the page.
 */
export function SchoolToys() {
  return (
    <ToyOverlay placements={PLACEMENTS}>
      <NinaToy act="teaching" size={240} slot={SCHOOL_NINA_ID} />
      <NinaToy act="typing" size={88} slot="forum-nina" />
      <NinaToy act="carrying" size={88} slot="library-nina" />
      <NinaToy act="writing" size={88} slot="tasks-nina" />
      <NinaToy act="stamping" size={88} slot="reports-nina" />
      <NinaToy act="searching" size={88} slot="insight-nina" />
      <NinaToy act="graduating" size={88} slot="graduation-nina" />
      <NinaToy act="waving" size={88} slot="parents-nina" />
    </ToyOverlay>
  );
}
