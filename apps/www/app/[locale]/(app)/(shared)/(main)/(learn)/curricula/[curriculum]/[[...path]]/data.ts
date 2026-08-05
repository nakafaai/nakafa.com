import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/routing/slug";

/** Builds sidebar chapter links from rendered material cards. */
export function readMaterialCardChapters(cards: MaterialList): ParsedHeading[] {
  return cards.map((card) => ({
    children: [],
    href: `#${slugify(card.title)}`,
    label: card.title,
  }));
}

/** Groups sibling curriculum rows by their signed display labels. */
export function groupCurriculumChildren<
  Route extends {
    readonly displayGroupTitle?: string;
  },
>(routes: readonly Route[]) {
  const groups = new Map<string, Route[]>();

  for (const route of routes) {
    const groupTitle = route.displayGroupTitle ?? "";
    groups.set(groupTitle, [...(groups.get(groupTitle) ?? []), route]);
  }

  return [...groups.entries()].map(([title, children]) => ({
    children,
    key: title || "curriculum",
    title: title || undefined,
  }));
}
