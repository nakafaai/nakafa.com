import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Effect } from "effect";
import { queryContentStore } from "@/lib/content/store/query";

type TryoutExamPageArgs = Ref.Args<typeof tryouts.queries.catalog.getExamPage>;
type TryoutSectionPageArgs = Ref.Args<
  typeof tryouts.queries.catalog.getSectionPage
>;

/**
 * Reads one signed exam page with its tracks, or null when the exam is not live.
 * The content store answers for the release, so the catalog and the routing
 * decisions share one read of each release.
 */
export const readPublishedTryoutExamPage = Effect.fn(
  "www.tryouts.readExamPage"
)(function* (args: TryoutExamPageArgs) {
  return yield* queryContentStore(tryouts.queries.catalog.getExamPage, args);
});

/**
 * Reads one signed section page, or null when the section is not a visible page.
 * The content store answers for the release, so the catalog and the routing
 * decisions share one read of each release.
 */
export const readPublishedTryoutSectionPage = Effect.fn(
  "www.tryouts.readSectionPage"
)(function* (args: TryoutSectionPageArgs) {
  return yield* queryContentStore(tryouts.queries.catalog.getSectionPage, args);
});
