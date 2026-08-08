import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { loadAttemptSections } from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import { loadCurrentAttempt } from "@repo/backend/convex/tryouts/runtime/attempt/state";
import {
  readLatestAttemptByPath,
  readOwnedAttemptById,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { loadSectionRuntime } from "@repo/backend/convex/tryouts/runtime/section/questions";
import { Effect } from "effect";

interface SetStateArgs {
  readonly attemptId?: string;
  readonly locale: "en" | "id";
  readonly publicPath: string;
}

/** Selects an exact attempt or the latest attempt for one localized set. */
const readCurrentUserSetAttempt = Effect.fn(
  "tryouts.runtime.readCurrentUserSetAttempt"
)(function* (ctx: QueryCtx, args: SetStateArgs) {
  const auth = yield* Effect.promise(() => getOptionalAppUserForRead(ctx));
  if (!auth) {
    return null;
  }

  let attempt: Doc<"tryoutAttempts"> | null = null;
  if (args.attemptId) {
    const attemptId = ctx.db.normalizeId("tryoutAttempts", args.attemptId);
    if (!attemptId) {
      return null;
    }
    attempt = yield* readOwnedAttemptById(ctx, attemptId, auth.appUser._id);
  } else {
    attempt = yield* readLatestAttemptByPath(ctx, args, auth.appUser._id);
  }

  if (!attempt || attempt.locale !== args.locale) {
    return null;
  }
  if (!args.attemptId && attempt.status !== "in-progress") {
    return null;
  }
  if (args.attemptId && attempt.setPublicPath !== args.publicPath) {
    return null;
  }
  return attempt;
});

/** Reads one cohesive set attempt and optional direct-entry runtime. */
export const readSetState = Effect.fn("tryouts.runtime.readSetState")(
  function* (ctx: QueryCtx, args: SetStateArgs) {
    const attempt = yield* readCurrentUserSetAttempt(ctx, args);
    if (!attempt) {
      return null;
    }

    const sections = yield* loadAttemptSections(ctx, attempt);
    const current = yield* loadCurrentAttempt(ctx, { attempt, sections });
    const entrySnapshot = attempt.sectionSnapshots.find(
      (snapshot) => snapshot.publicPath === undefined
    );
    const entrySection = entrySnapshot
      ? (sections.find(
          (section) => section.sectionKey === entrySnapshot.sectionKey
        ) ?? null)
      : null;
    const runtime = entrySection
      ? yield* loadSectionRuntime(ctx, attempt, entrySection)
      : null;

    return { attempt: current, runtime };
  }
);
