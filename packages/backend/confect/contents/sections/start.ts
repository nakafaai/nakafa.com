import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { Config, Duration, Effect, Option, Schema } from "effect";

/**
 * `off` on a deployment that keeps no section index. A build pays the gateway for
 * every text it has not embedded, and the dev deployment takes every release that
 * production takes, for no learner: it paid as much as production.
 */
const SectionIndexSwitch = Config.option(
  Config.schema(Schema.Literal("off"), "SECTION_INDEX")
);

/**
 * Starts the build of the section index for a release that has just become
 * active. It is called in the transaction that makes the release active, so
 * the build is queued exactly when the activation commits, and it runs on its
 * own after the activation, so the activation itself stays as it was.
 */
export const startSectionBuild = Effect.fn("contents.sections.start")(
  function* (releaseId: string) {
    if (Option.isSome(yield* SectionIndexSwitch.pipe(Effect.orDie))) {
      return;
    }
    const scheduler = yield* Scheduler;
    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contents.sections.build.run,
      { releaseId }
    );
  }
);
