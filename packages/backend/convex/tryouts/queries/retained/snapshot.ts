import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutSnapshotCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  readPublishedSectionPage,
  readPublishedSetPage,
} from "@repo/backend/convex/tryouts/catalog/published";
import { matchesAttemptIdentity } from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

interface RetainedPath {
  readonly locale: "en" | "id";
  readonly publicPath: string;
}

/** Reads and verifies one set page from the attempt-owned source snapshot. */
export const readRetainedSetPage = Effect.fn(
  "tryouts.retained.readSetSnapshot"
)(function* (
  ctx: QueryCtx,
  args: RetainedPath,
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity
) {
  const page = yield* readSignedSetPage(
    ctx,
    args.locale,
    args.publicPath,
    attempt.tryoutSnapshotId
  );
  if (!(page && matchesSetPage(attempt, identity, page))) {
    return null;
  }
  return page;
});

/** Reads and verifies one section page from the attempt-owned source snapshot. */
export const readRetainedSectionPage = Effect.fn(
  "tryouts.retained.readSectionSnapshot"
)(function* (ctx: QueryCtx, args: RetainedPath, attempt: TryoutAttempt) {
  const catalog = yield* loadTryoutSnapshotCatalog(
    ctx,
    args.locale,
    attempt.tryoutSnapshotId
  );
  return yield* readPublishedSectionPage(catalog, args.publicPath);
});

/** Reads one set from the immutable signed catalog retained by an attempt. */
const readSignedSetPage = Effect.fn("tryouts.retained.readSignedSet")(
  function* (
    ctx: QueryCtx,
    locale: "en" | "id",
    publicPath: string,
    snapshotId: string
  ) {
    const catalog = yield* loadTryoutSnapshotCatalog(ctx, locale, snapshotId);
    return yield* readPublishedSetPage(catalog, publicPath);
  }
);

/** Checks one retained page against the attempt's immutable set snapshot. */
function matchesSetPage(
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  page: {
    readonly entrySection: {
      readonly publicPath?: string;
      readonly questionCount: number;
      readonly sectionKey: string;
      readonly timeLimitSeconds: number;
      readonly visibility: "internal-entry" | "visible";
    } | null;
    readonly sections: readonly {
      readonly publicPath?: string;
      readonly questionCount: number;
      readonly sectionKey: string;
      readonly timeLimitSeconds: number;
    }[];
    readonly set: {
      readonly countryKey: string;
      readonly examKey: string;
      readonly publicPath: string;
      readonly setKey: string;
      readonly totalQuestionCount: number;
      readonly trackKey: string;
    };
  }
) {
  const pageIdentity = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: identity.locale,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  if (
    !matchesAttemptIdentity(identity, pageIdentity) ||
    page.set.publicPath !== attempt.setPublicPath ||
    page.set.totalQuestionCount !== attempt.totalQuestions
  ) {
    return false;
  }

  const sections =
    page.entrySection?.visibility === "internal-entry"
      ? [page.entrySection, ...page.sections]
      : page.sections;
  if (sections.length !== attempt.sectionSnapshots.length) {
    return false;
  }
  return attempt.sectionSnapshots.every((snapshot) => {
    const section = sections.find(
      (candidate) => candidate.sectionKey === snapshot.sectionKey
    );
    if (!section) {
      return false;
    }
    return (
      section.publicPath === snapshot.publicPath &&
      section.questionCount === snapshot.questionCount &&
      section.timeLimitSeconds === snapshot.timeLimitSeconds
    );
  });
}
