// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  ModelBuildCoordinator,
  type ModelBuildCoordinatorService,
  type ModelBuildWaitPolicy,
  waitForModelBuild,
} from "@repo/backend/convex/contentRelease/ingress/models";
import type {
  ModelBuildRestartArgs,
  ModelBuildRestartResult,
  ModelBuildStatus,
} from "@repo/backend/convex/contentRelease/models/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Data, Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

const releaseId = ReleaseIdSchema.make("release-model-waiter");

class UnexpectedModelState extends Data.TaggedError("UnexpectedModelState")<{
  readonly operation: "restart" | "status";
}> {}

/** Allocates valid scheduler identities without executing their test jobs. */
const createScheduledJobIds = Effect.fn(
  "test.contentRelease.createScheduledJobIds"
)(function* () {
  const target = yield* Effect.sync(() => convexTest(schema, convexModules));
  return yield* Effect.all([
    Effect.promise(() =>
      target.mutation((ctx) =>
        ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
          generation: 1,
          releaseId,
        })
      )
    ),
    Effect.promise(() =>
      target.mutation((ctx) =>
        ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
          generation: 2,
          releaseId,
        })
      )
    ),
  ]);
});

/** Builds one deterministic model coordinator and records restart attempts. */
function makeCoordinator(
  statuses: readonly ModelBuildStatus[],
  restartResults: readonly ModelBuildRestartResult[] = []
) {
  const restarts: ModelBuildRestartArgs[] = [];
  let restartIndex = 0;
  let statusIndex = 0;
  const service: ModelBuildCoordinatorService = {
    restart: (args) => {
      restarts.push(args);
      const result = restartResults[restartIndex];
      restartIndex += 1;
      return result
        ? Effect.succeed(result)
        : Effect.die(new UnexpectedModelState({ operation: "restart" }));
    },
    status: () => {
      const status = statuses[statusIndex];
      statusIndex += 1;
      return status
        ? Effect.succeed(status)
        : Effect.die(new UnexpectedModelState({ operation: "status" }));
    },
  };
  return { restarts, service };
}

/** Runs one waiter policy at the explicit Effect test boundary. */
function runWait(
  policy: ModelBuildWaitPolicy,
  service: ModelBuildCoordinatorService
) {
  return waitForModelBuild(releaseId, policy).pipe(
    Effect.provideService(ModelBuildCoordinator, service)
  );
}

describe("contentRelease/ingress/models", () => {
  it.effect("observes failure without an unauthorized restart", () =>
    Effect.gen(function* () {
      const [failedJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeCoordinator([
        {
          phase: "failed",
          releaseId,
          syncGeneration: 1,
          syncJobId: failedJobId,
        },
      ]);

      expect(
        yield* runWait("observe", service).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(restarts).toEqual([]);
    })
  );

  it.effect("restarts one failed build and follows its winning lineage", () =>
    Effect.gen(function* () {
      const [failedJobId, successorJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeCoordinator(
        [
          {
            phase: "failed",
            releaseId,
            syncGeneration: 1,
            syncJobId: failedJobId,
          },
          { phase: "completed", releaseId },
        ],
        [
          {
            status: "restarted",
            syncGeneration: 2,
            syncJobId: successorJobId,
          },
        ]
      );

      expect(yield* runWait("restart-failed-once", service)).toBeUndefined();
      expect(restarts).toEqual([
        {
          expectedGeneration: 1,
          expectedJobId: failedJobId,
          releaseId,
        },
      ]);
    })
  );

  it.effect("follows a concurrent winner after a stale restart", () =>
    Effect.gen(function* () {
      const [failedJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeCoordinator(
        [
          {
            phase: "failed",
            releaseId,
            syncGeneration: 1,
            syncJobId: failedJobId,
          },
          { phase: "ready", releaseId },
        ],
        [{ status: "stale" }]
      );

      expect(yield* runWait("restart-failed-once", service)).toBeUndefined();
      expect(restarts).toHaveLength(1);
    })
  );

  it.effect("fails after the sole restarted lineage also fails", () =>
    Effect.gen(function* () {
      const [failedJobId, successorJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeCoordinator(
        [
          {
            phase: "failed",
            releaseId,
            syncGeneration: 1,
            syncJobId: failedJobId,
          },
          {
            phase: "failed",
            releaseId,
            syncGeneration: 2,
            syncJobId: successorJobId,
          },
        ],
        [
          {
            status: "restarted",
            syncGeneration: 2,
            syncJobId: successorJobId,
          },
        ]
      );

      expect(
        yield* runWait("restart-failed-once", service).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
      expect(restarts).toHaveLength(1);
    })
  );

  it.effect("polls actual running state until the build is ready", () =>
    Effect.gen(function* () {
      const [runningJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeCoordinator([
        {
          phase: "building",
          releaseId,
          syncGeneration: 1,
          syncJobId: runningJobId,
        },
        { phase: "ready", releaseId },
      ]);

      const waiting = yield* runWait("observe", service).pipe(Effect.forkChild);
      yield* TestClock.adjust(Duration.millis(100));

      expect(yield* Fiber.join(waiting)).toBeUndefined();
      expect(restarts).toEqual([]);
    })
  );
});
