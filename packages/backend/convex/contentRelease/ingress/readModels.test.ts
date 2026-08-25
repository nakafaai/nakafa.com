// @vitest-environment node

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
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const releaseId = ReleaseIdSchema.make("release-read-model-waiter");

/** Allocates valid scheduler identities without executing their test jobs. */
function createScheduledJobIds() {
  const t = convexTest(schema, convexModules);
  return t.mutation((ctx) =>
    Promise.all([
      ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
        generation: 1,
        releaseId,
      }),
      ctx.scheduler.runAfter(0, internal.contentRelease.models.resume, {
        generation: 2,
        releaseId,
      }),
    ])
  );
}

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
        : Effect.die(new Error("Unexpected read-model restart."));
    },
    status: () => {
      const status = statuses[statusIndex];
      statusIndex += 1;
      return status
        ? Effect.succeed(status)
        : Effect.die(new Error("Unexpected read-model status poll."));
    },
  };
  return { restarts, service };
}

/** Runs one waiter policy at the explicit test boundary. */
function runReadModelWait(
  policy: ReadModelWaitPolicy,
  service: ReadModelCoordinatorService
) {
  return Effect.runPromise(
    waitForReadModels(releaseId, policy).pipe(
      Effect.provideService(ReadModelCoordinator, service)
    )
  );
}

afterEach(() => vi.useRealTimers());

describe("content release read-model waiter", () => {
  it("observes an initial activation failure without restarting", async () => {
    const [failedJobId] = await createScheduledJobIds();
    const { restarts, service } = makeReadModelCoordinator([
      {
        phase: "failed",
        releaseId,
        syncGeneration: 1,
        syncJobId: failedJobId,
      },
    ]);

    await expect(runReadModelWait("observe", service)).rejects.toMatchObject({
      _tag: "ReleaseError",
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    expect(restarts).toEqual([]);
  });

  it("restarts one explicitly retried failed activation", async () => {
    const [failedJobId, successorJobId] = await createScheduledJobIds();
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

    await expect(
      runReadModelWait("restart-failed-once", service)
    ).resolves.toBeUndefined();
    expect(restarts).toEqual([
      {
        expectedGeneration: 1,
        expectedJobId: failedJobId,
        releaseId,
      },
    ]);
  });

  it("follows the winning lineage after a stale restart", async () => {
    const [failedJobId] = await createScheduledJobIds();
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

    await expect(
      runReadModelWait("restart-failed-once", service)
    ).resolves.toBeUndefined();
    expect(restarts).toHaveLength(1);
  });

  it("fails after the sole successor also reaches terminal failure", async () => {
    const [failedJobId, successorJobId] = await createScheduledJobIds();
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

    await expect(
      runReadModelWait("restart-failed-once", service)
    ).rejects.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    expect(restarts).toHaveLength(1);
  });

  it("polls a running lineage until it completes", async () => {
    vi.useFakeTimers();
    const [runningJobId] = await createScheduledJobIds();
    const { restarts, service } = makeReadModelCoordinator([
      {
        phase: "syncing",
        releaseId,
        syncGeneration: 1,
        syncJobId: runningJobId,
      },
      { phase: "completed", releaseId },
    ]);

    const waiting = runReadModelWait("observe", service);
    await vi.advanceTimersByTimeAsync(100);

    await expect(waiting).resolves.toBeUndefined();
    expect(restarts).toEqual([]);
  });
});
