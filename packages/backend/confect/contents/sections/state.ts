import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { loadState } from "@repo/backend/confect/contentRelease/model";
import type { finishInputValidator } from "@repo/backend/confect/contents/sections/schema";
import { Effect, Option } from "effect";

/** Reads the one record of the last build that finished. */
const findBuild = Effect.fn("contents.sections.findBuild")(function* () {
  return yield* (yield* DatabaseReader)
    .table("contentSectionState")
    .get("by_key", "primary")
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** The sequence of `releaseId` when it is the release that is active now, and none when it is not. */
export const activeSequence = Effect.fn("contents.sections.activeSequence")(
  function* (releaseId: string) {
    const state = yield* loadState();
    return state?.activeReleaseId === releaseId
      ? Option.fromNullishOr(state.activeSequence)
      : Option.none<number>();
  }
);

/** Whether `releaseId` is the release that is active now. */
export const isActive = Effect.fn("contents.sections.isActive")(function* (
  releaseId: string
) {
  return Option.isSome(yield* activeSequence(releaseId));
});

/**
 * Whether search may trust the index: the last build that finished indexed the
 * release that is active now, with `model`, the model that embeds the
 * questions. A build that is still running, one that stopped, a release that
 * became active after the build, and a change of model all leave the index
 * unfit, because it then lacks sections, holds sections of a release that is
 * gone, or holds vectors that the questions cannot be compared with.
 */
export const isReady = Effect.fn("contents.sections.isReady")(function* (
  model: string
) {
  const state = yield* loadState();
  const build = yield* findBuild();
  return (
    state?.activeReleaseId !== undefined &&
    build?.releaseId === state.activeReleaseId &&
    build.model === model
  );
});

/**
 * Records that the index of `releaseId`, made by `model`, is finished, and how
 * many of its sections the build left out, which is none when the index is
 * complete. Search may trust the index whatever that count is, and the count says
 * how much of the release it lacks. Nothing is recorded once the release is no
 * longer the active one, because the build of the newer release records its own,
 * and a record that already says the same is not written again.
 */
export const finishBuild = Effect.fn("contents.sections.finish")(function* (
  input: typeof finishInputValidator.Type
) {
  if (!(yield* isActive(input.releaseId))) {
    return { recorded: false };
  }
  yield* Effect.logInfo("Section build finished.").pipe(
    Effect.annotateLogs({
      complete: input.missing === 0,
      missing: input.missing,
      releaseId: input.releaseId,
    })
  );
  const build = yield* findBuild();
  if (
    build?.releaseId === input.releaseId &&
    build.model === input.model &&
    build.missing === input.missing
  ) {
    return { recorded: true };
  }
  const table = (yield* DatabaseWriter).table("contentSectionState");
  const record = { key: "primary" as const, ...input };
  yield* (
    build === null
      ? Effect.asVoid(table.insert(record))
      : table.replace(build._id, record)
  ).pipe(Effect.orDie);
  return { recorded: true };
});
