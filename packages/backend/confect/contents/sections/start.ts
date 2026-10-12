import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { Duration, Effect } from "effect";

/**
 * Starts the build of the section index for a release that has just become
 * active. It is called in the transaction that makes the release active, so
 * the build is queued exactly when the activation commits, and it runs on its
 * own after the activation, so the activation itself stays as it was.
 */
export const startSectionBuild = Effect.fn("contents.sections.start")(
  function* (releaseId: string) {
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contents.sections.build.run,
      { releaseId }
    );
  }
);
