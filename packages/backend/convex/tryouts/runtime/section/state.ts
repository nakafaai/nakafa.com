import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { loadAttemptSections } from "@repo/backend/convex/tryouts/runtime/attempt/sections";
import { loadAttemptState } from "@repo/backend/convex/tryouts/runtime/attempt/state";
import { noTryoutSectionContentAccess } from "@repo/backend/convex/tryouts/runtime/content";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import { readOwnedAttemptById } from "@repo/backend/convex/tryouts/runtime/lookup";
import { loadSectionState } from "@repo/backend/convex/tryouts/runtime/section/questions";
import { Effect } from "effect";

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
