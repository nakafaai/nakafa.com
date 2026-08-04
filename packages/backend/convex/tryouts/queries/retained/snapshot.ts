import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutSnapshotCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  readFilesystemSection,
  readFilesystemSet,
} from "@repo/backend/convex/tryouts/catalog/filesystem/content";
import {
  readPublishedSectionPage,
  readPublishedSetPage,
} from "@repo/backend/convex/tryouts/catalog/published";
import { matchesAttemptIdentity } from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

interface RetainedPath {
  readonly locale: "en" | "id";
  readonly publicPath: string;
}

interface RetainedSectionPath extends RetainedPath {
  readonly setPublicPath: string;
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
  const page = attempt.tryoutSnapshotId
    ? yield* readSignedSetPage(
        ctx,
        args.locale,
        args.publicPath,
        attempt.tryoutSnapshotId
      )
    : yield* readFilesystemSetPage(ctx, args, attempt, identity);
  if (!(page && matchesSetPage(attempt, identity, page))) {
    return null;
  }
  return page;
});

/** Reads and verifies one section page from the attempt-owned source snapshot. */
export const readRetainedSectionPage = Effect.fn(
  "tryouts.retained.readSectionSnapshot"
)(function* (
  ctx: QueryCtx,
  args: RetainedSectionPath,
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  snapshot: TryoutSectionSnapshot
) {
  if (attempt.tryoutSnapshotId) {
    const catalog = yield* loadTryoutSnapshotCatalog(
      ctx,
      args.locale,
      attempt.tryoutSnapshotId
    );
    return yield* readPublishedSectionPage(catalog, args.publicPath);
  }
  return yield* readFilesystemSectionPage(
    ctx,
    args,
    attempt,
    identity,
    snapshot
  );
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

/** Reads a local set only while every frozen source row remains intact. */
const readFilesystemSetPage = Effect.fn("tryouts.retained.readFilesystemSet")(
  function* (
    ctx: QueryCtx,
    args: RetainedPath,
    attempt: TryoutAttempt,
    identity: TryoutSetIdentity
  ) {
    const tryoutSetId = attempt.tryoutSetId;
    if (!tryoutSetId) {
      return null;
    }
    const set = yield* Effect.promise(() => ctx.db.get(tryoutSetId));
    if (
      !(
        set?.isActive &&
        set.isReady &&
        set.countryKey === identity.countryKey &&
        set.examKey === identity.examKey &&
        set.locale === args.locale &&
        set.publicPath === args.publicPath &&
        set.sectionCount === attempt.sectionSnapshots.length &&
        set.setKey === identity.setKey &&
        set.totalQuestionCount === attempt.totalQuestions &&
        set.trackKey === identity.trackKey &&
        attempt.sectionSnapshots.every(
          (snapshot) => snapshot.sourceRevision === set.sourceRevision
        )
      )
    ) {
      return null;
    }

    const matches = yield* Effect.forEach(
      attempt.sectionSnapshots,
      (snapshot) =>
        filesystemSectionMatches(ctx, snapshot, identity, tryoutSetId)
    );
    if (matches.includes(false)) {
      return null;
    }
    return yield* readFilesystemSet(ctx, args);
  }
);

/** Reads a local section only while its frozen source rows remain intact. */
const readFilesystemSectionPage = Effect.fn(
  "tryouts.retained.readFilesystemSection"
)(function* (
  ctx: QueryCtx,
  args: RetainedSectionPath,
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  snapshot: TryoutSectionSnapshot
) {
  const tryoutSetId = attempt.tryoutSetId;
  if (!tryoutSetId) {
    return null;
  }
  const [set, sectionMatches] = yield* Effect.all(
    [
      Effect.promise(() => ctx.db.get(tryoutSetId)),
      filesystemSectionMatches(ctx, snapshot, identity, tryoutSetId),
    ],
    { concurrency: "unbounded" }
  );
  if (
    !(
      set &&
      sectionMatches &&
      set.countryKey === identity.countryKey &&
      set.examKey === identity.examKey &&
      set.locale === args.locale &&
      set.publicPath === args.setPublicPath &&
      set.setKey === identity.setKey &&
      set.trackKey === identity.trackKey &&
      snapshot.publicPath === args.publicPath
    )
  ) {
    return null;
  }
  return yield* readFilesystemSection(ctx, args);
});

/** Verifies one filesystem section against the attempt snapshot fields. */
const filesystemSectionMatches = Effect.fn(
  "tryouts.retained.filesystemSectionMatches"
)(function* (
  ctx: QueryCtx,
  snapshot: TryoutSectionSnapshot,
  identity: TryoutSetIdentity,
  tryoutSetId: Doc<"tryoutSets">["_id"]
) {
  const tryoutSectionId = snapshot.tryoutSectionId;
  const questionSetId = snapshot.questionSetId;
  if (!(tryoutSectionId && questionSetId)) {
    return false;
  }
  const section = yield* Effect.promise(() => ctx.db.get(tryoutSectionId));
  return Boolean(
    section &&
      section.countryKey === identity.countryKey &&
      section.examKey === identity.examKey &&
      section.locale === identity.locale &&
      section.order === snapshot.sectionOrder &&
      section.publicPath === snapshot.publicPath &&
      section.questionCount === snapshot.questionCount &&
      section.questionSetId === questionSetId &&
      section.questionSourcePath === snapshot.questionSourcePath &&
      section.sectionKey === snapshot.sectionKey &&
      section.setKey === identity.setKey &&
      section.sourceRevision === snapshot.sourceRevision &&
      section.timeLimitSeconds === snapshot.timeLimitSeconds &&
      section.trackKey === identity.trackKey &&
      section.tryoutSetId === tryoutSetId
  );
});

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
