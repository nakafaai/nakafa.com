import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Effect } from "effect";
import { querySnapshotContentStore } from "@/lib/content/store/query";

type TryoutCountryPageArgs = Ref.Args<
  typeof tryouts.queries.catalog.getCountryPage
>;
type TryoutExamPageArgs = Ref.Args<typeof tryouts.queries.catalog.getExamPage>;
type TryoutGroupPageArgs = Ref.Args<
  typeof tryouts.queries.catalog.getGroupPage
>;
type TryoutSectionPageArgs = Ref.Args<
  typeof tryouts.queries.catalog.getSectionPage
>;

/**
 * Reads one signed country with its exams and its entry, or null when the
 * country is not live. The content store answers for the release, so the
 * catalog and the routing decisions share one read of each release.
 */
export const readPublishedTryoutCountryPage = Effect.fn(
  "www.tryouts.readCountryPage"
)(function* (args: TryoutCountryPageArgs) {
  return yield* querySnapshotContentStore(
    "assessment",
    tryouts.queries.catalog.getCountryPage,
    args
  );
});

/**
 * Reads one signed exam with its groups, or null when the exam is not live.
 * The content store answers for the release, so the catalog and the routing
 * decisions share one read of each release.
 */
export const readPublishedTryoutExamPage = Effect.fn(
  "www.tryouts.readExamPage"
)(function* (args: TryoutExamPageArgs) {
  return yield* querySnapshotContentStore(
    "assessment",
    tryouts.queries.catalog.getExamPage,
    args
  );
});

/**
 * Reads one signed group page with its tracks, or null when the group is not live.
 * The content store answers for the release, so the catalog and the routing
 * decisions share one read of each release.
 */
export const readPublishedTryoutGroupPage = Effect.fn(
  "www.tryouts.readGroupPage"
)(function* (args: TryoutGroupPageArgs) {
  return yield* querySnapshotContentStore(
    "assessment",
    tryouts.queries.catalog.getGroupPage,
    args
  );
});

/**
 * Reads one signed section page, or null when the section is not a visible page.
 * The content store answers for the release, so the catalog and the routing
 * decisions share one read of each release.
 */
export const readPublishedTryoutSectionPage = Effect.fn(
  "www.tryouts.readSectionPage"
)(function* (args: TryoutSectionPageArgs) {
  return yield* querySnapshotContentStore(
    "assessment",
    tryouts.queries.catalog.getSectionPage,
    args
  );
});
