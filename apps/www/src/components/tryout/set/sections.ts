import type { SectionVisibilitySchema } from "@nakafa/aksara-contracts/assessment/catalog";

/**
 * The sections a learner sits in one set. Aksara gives a set either visible sections or one internal
 * section that the set is entered through, and nothing else. A set page lists only the visible ones, so a
 * set entered directly, such as every TKA set, lists none, and its one section is its entry.
 */
export function readSetSections<
  Section extends { readonly visibility: typeof SectionVisibilitySchema.Type },
>(page: {
  readonly entrySection: Section;
  readonly sections: readonly Section[];
}) {
  return page.entrySection.visibility === "internal-entry"
    ? [page.entrySection]
    : page.sections;
}
