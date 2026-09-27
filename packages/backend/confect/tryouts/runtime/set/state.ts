import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import { loadAttemptSections } from "@repo/backend/confect/tryouts/runtime/attempt/sections";
import { loadAttemptState } from "@repo/backend/confect/tryouts/runtime/attempt/state";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadSectionState } from "@repo/backend/confect/tryouts/runtime/section/questions";
import { noTryoutSectionContentAccess } from "@repo/backend/confect/tryouts/runtime/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Loads one exact attempt without repeating immutable catalog reads. */
export const loadSetAttemptState = Effect.fn(
  "tryouts.runtime.loadSetAttemptState"
)(function* (ctx: QueryCtx, attempt: Doc<"tryoutAttempts">) {
  const sections = yield* loadAttemptSections(ctx, attempt);
  const entrySnapshot = attempt.sectionSnapshots.find(
    (snapshot) => snapshot.publicPath === undefined
  );
  const entrySection = entrySnapshot
    ? sections.find(
        (section) => section.sectionKey === entrySnapshot.sectionKey
      )
    : undefined;
  const { current, entry } = yield* Effect.all(
    {
      current: loadAttemptState(ctx, {
        attempt,
        sections,
      }),
      entry: entrySection
        ? loadSectionState(ctx, attempt, entrySection)
        : Effect.succeed({
            content: noTryoutSectionContentAccess,
            runtime: null,
          }),
    },
    {
      concurrency: "unbounded",
    }
  );
  return {
    content: entry.content,
    state: {
      attempt: current,
      runtime: entry.runtime,
    },
  };
});

/** Reads one mutable set state through an exact owned attempt ID. */
export const readSetAttemptState = Effect.fn(
  "tryouts.runtime.readSetAttemptState"
)(function* (ctx: QueryCtx, attemptId: Id<"tryoutAttempts">) {
  const auth = yield* getOptionalAppUserForRead(ctx);
  if (!auth) {
    return null;
  }
  const attempt = yield* readOwnedAttemptById(ctx, attemptId, auth.appUser._id);
  if (!attempt) {
    return null;
  }
  const loaded = yield* loadSetAttemptState(ctx, attempt);
  return loaded.state;
});
