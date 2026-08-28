// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  ReadModelCoordinator,
  type ReadModelCoordinatorService,
  type ReadModelWaitPolicy,
  waitForReadModels,
} from "@repo/backend/convex/contentRelease/ingress/readModels";
import type {
  ReadModelRestartArgs,
  ReadModelRestartResult,
  ReadModelStatus,
} from "@repo/backend/convex/contentRelease/models";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Data, Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

const releaseId = ReleaseIdSchema.make("release-read-model-waiter");

class UnexpectedReadModelTestState extends Data.TaggedError(
  "UnexpectedReadModelTestState"
)<{
  readonly operation: "restart" | "status";
}> {}

/** Allocates valid scheduler identities without executing their test jobs. */
const createScheduledJobIds = Effect.fn(
  "test.contentRelease.createScheduledJobIds"
)(function* () {
  const t = yield* Effect.sync(() => convexTest(schema, convexModules));
  return yield* Effect.all([
    Effect.promise(() =>
      t.mutation((ctx) =>
        ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
          generation: 1,
          releaseId,
        })
      )
    ),
    Effect.promise(() =>
      t.mutation((ctx) =>
        ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
          generation: 2,
          releaseId,
        })
      )
    ),
  ]);
});

/** Builds a deterministic coordinator for one waiter state-machine proof. */
function makeReadModelCoordinator(
  statuses: readonly ReadModelStatus[],
  restartResults: readonly ReadModelRestartResult[] = []
) {
  const restarts: ReadModelRestartArgs[] = [];
  let restartIndex = 0;
  let statusIndex = 0;
  const service: ReadModelCoordinatorService = {
    restart: (args) => {
      restarts.push(args);
      const result = restartResults[restartIndex];
      restartIndex += 1;
      return result
        ? Effect.succeed(result)
        : Effect.die(
            new UnexpectedReadModelTestState({ operation: "restart" })
          );
    },
    status: () => {
      const status = statuses[statusIndex];
      statusIndex += 1;
      return status
        ? Effect.succeed(status)
        : Effect.die(new UnexpectedReadModelTestState({ operation: "status" }));
    },
  };
  return { restarts, service };
}

/** Runs one waiter policy at the explicit test boundary. */
function runReadModelWait(
  policy: ReadModelWaitPolicy,
  service: ReadModelCoordinatorService
) {
  return waitForReadModels(releaseId, policy).pipe(
    Effect.provideService(ReadModelCoordinator, service)
  );
}

describe("content release read-model waiter", () => {
  it.effect("observes an initial activation failure without restarting", () =>
    Effect.gen(function* () {
      const [failedJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeReadModelCoordinator([
        {
          phase: "failed",
          releaseId,
          syncGeneration: 1,
          syncJobId: failedJobId,
        },
      ]);

      expect(
        yield* runReadModelWait("observe", service).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(restarts).toEqual([]);
    })
  );

  it.effect("restarts one explicitly retried failed activation", () =>
    Effect.gen(function* () {
      const [failedJobId, successorJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeReadModelCoordinator(
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

      expect(
        yield* runReadModelWait("restart-failed-once", service)
      ).toBeUndefined();
      expect(restarts).toEqual([
        {
          expectedGeneration: 1,
          expectedJobId: failedJobId,
          releaseId,
        },
      ]);
    })
  );

  it.effect("follows the winning lineage after a stale restart", () =>
    Effect.gen(function* () {
      const [failedJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeReadModelCoordinator(
        [
          {
            phase: "failed",
            releaseId,
            syncGeneration: 1,
            syncJobId: failedJobId,
          },
          { phase: "completed", releaseId },
        ],
        [{ status: "stale" }]
      );

      expect(
        yield* runReadModelWait("restart-failed-once", service)
      ).toBeUndefined();
      expect(restarts).toHaveLength(1);
    })
  );

  it.effect(
    "fails after the sole successor also reaches terminal failure",
    () =>
      Effect.gen(function* () {
        const [failedJobId, successorJobId] = yield* createScheduledJobIds();
        const { restarts, service } = makeReadModelCoordinator(
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
          yield* runReadModelWait("restart-failed-once", service).pipe(
            Effect.flip
          )
        ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
        expect(restarts).toHaveLength(1);
      })
  );

  it.effect("polls a running lineage until it completes", () =>
    Effect.gen(function* () {
      const [runningJobId] = yield* createScheduledJobIds();
      const { restarts, service } = makeReadModelCoordinator([
        {
          phase: "syncing",
          releaseId,
          syncGeneration: 1,
          syncJobId: runningJobId,
        },
        { phase: "completed", releaseId },
      ]);

      const waiting = yield* runReadModelWait("observe", service).pipe(
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.millis(100));

      expect(yield* Fiber.join(waiting)).toBeUndefined();
      expect(restarts).toEqual([]);
    })
  );
});
