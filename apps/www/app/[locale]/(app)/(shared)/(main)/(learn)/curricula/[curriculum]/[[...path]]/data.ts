import type { MaterialList } from "@repo/contents/curriculum/list";
import type { ParsedHeading } from "@repo/contents/toc";
import { slugify } from "@repo/design-system/lib/routing/slug";

/** Builds sidebar chapter links from rendered material cards. */
export function readMaterialCardChapters(cards: MaterialList): ParsedHeading[] {
  return cards.map((card) => ({
    children: [],
    href: `#${slugify(card.title)}`,
    label: card.title,
  }));
}
