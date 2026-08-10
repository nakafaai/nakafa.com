import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  loadAttemptSections,
  readAttemptResume,
} from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import { loadAttemptState } from "@repo/backend/convex/tryouts/runtime/attempt/state";
import { noTryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import {
  readLatestAttemptByPath,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import {
  loadSectionRuntime,
  loadSectionState,
  readCurrentSection,
} from "@repo/backend/convex/tryouts/runtime/section/questions";
import { Effect } from "effect";

interface SectionStateArgs {
  readonly attemptId?: string;
  readonly locale: "en" | "id";
  readonly publicPath: string;
}

/** Loads one exact section without repeating immutable catalog reads. */
export const loadSectionAttemptState = Effect.fn(
  "tryouts.runtime.loadSectionAttemptState"
)(function* (
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">,
  sectionKey: string
) {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );
  if (!snapshot) {
    return null;
  }

  const sections = yield* loadAttemptSections(ctx, attempt);
  const section =
    sections.find((candidate) => candidate.sectionKey === sectionKey) ?? null;
  const { current, loaded } = yield* Effect.all(
    {
      current: loadAttemptState(ctx, { attempt, sectionKey, sections }),
      loaded: section
        ? loadSectionState(ctx, attempt, section)
        : Effect.succeed({
            content: noTryoutSectionContentAccess,
            runtime: null,
          }),
    },
    { concurrency: "unbounded" }
  );

  return {
    content: loaded.content,
    state: {
      attempt: current,
      runtime: loaded.runtime,
    },
  };
});

/** Reads one mutable section state through an exact owned attempt ID. */
export const readSectionAttemptState = Effect.fn(
  "tryouts.runtime.readSectionAttemptState"
)(function* (
  ctx: QueryCtx,
  args: {
    readonly attemptId: Id<"tryoutAttempts">;
    readonly sectionKey: string;
  }
) {
  const auth = yield* tryRuntimePromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }

  const attempt = yield* readOwnedAttemptById(
    ctx,
    args.attemptId,
    auth.appUser._id
  );
  if (!attempt) {
    return null;
  }

  const loaded = yield* loadSectionAttemptState(ctx, attempt, args.sectionKey);
  return loaded?.state ?? null;
});

/** Resolves one owned section through its exact localized public path. */
const readCurrentUserSectionSelection = Effect.fn(
  "tryouts.runtime.readCurrentUserSectionSelection"
)(function* (ctx: QueryCtx, args: SectionStateArgs) {
  const auth = yield* tryRuntimePromise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }

  const separator = args.publicPath.lastIndexOf("/");
  if (separator <= 0) {
    return null;
  }
  const setPublicPath = args.publicPath.slice(0, separator);

  let attempt: Doc<"tryoutAttempts"> | null = null;
  if (args.attemptId) {
    const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
    if (!attemptId) {
      return null;
    }
    attempt = yield* readOwnedAttemptById(ctx, attemptId, auth.appUser._id);
  } else {
    attempt = yield* readLatestAttemptByPath(
      ctx,
      { locale: args.locale, publicPath: setPublicPath },
      auth.appUser._id
    );
    if (attempt?.status !== "in-progress") {
      return null;
    }
  }
  if (!attempt || attempt.locale !== args.locale) {
    return null;
  }

  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.publicPath === args.publicPath
  );
  if (!snapshot) {
    return null;
  }
  return { attempt, sectionKey: snapshot.sectionKey };
});

/** Reads one reactive attempt and its selected section runtime. */
export const readSectionState = Effect.fn("tryouts.runtime.readSectionState")(
  function* (ctx: QueryCtx, args: SectionStateArgs) {
    const selected = yield* readCurrentUserSectionSelection(ctx, args);
    if (!selected) {
      return null;
    }
    const { attempt, sectionKey } = selected;
    const sections = yield* loadAttemptSections(ctx, attempt);
    const section =
      sections.find((candidate) => candidate.sectionKey === sectionKey) ?? null;
    const resume = readAttemptResume(attempt, sections);
    const runtime = section
      ? yield* loadSectionRuntime(ctx, attempt, section)
      : null;
    const currentSection = section ? yield* readCurrentSection(section) : null;

    return {
      attempt: {
        attemptId: attempt._id,
        expiresAt: attempt.expiresAt,
        resumeSectionKey: resume.resumeSectionKey,
        resumeSectionPublicPath: resume.resumeSectionPublicPath,
        section: currentSection,
        status: attempt.status,
      },
      runtime,
    };
  }
);
