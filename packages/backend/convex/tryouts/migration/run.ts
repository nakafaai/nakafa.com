"use node";

import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { readMigrationStatus } from "@repo/backend/convex/tryouts/migration/status";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type RunRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "run" }
>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;

const beginReference = makeFunctionReference<
  "mutation",
  { migrationId: string },
  MigrationStatus
>("tryouts/migration/lifecycle:begin");
const finalizeReference = makeFunctionReference<
  "mutation",
  { migrationId: string },
  MigrationStatus
>("tryouts/migration/lifecycle:finalize");
interface AttemptPage {
  readonly done: boolean;
  readonly migrated: 0 | 1;
}

const nextReference = makeFunctionReference<
  "mutation",
  { migrationId: string },
  AttemptPage
>("tryouts/migration/attempt/run:next");

/** Drains bounded one-attempt transactions without persistent runner state. */
export const drainAttempts = Effect.fn("tryouts.migration.drainAttempts")(
  function* (
    next: () => Effect.Effect<AttemptPage, ReleaseError>,
    maximumAttempts: number
  ) {
    let migrated = 0;
    for (let call = 0; call < maximumAttempts + 1; call += 1) {
      const page = yield* next();
      if (page.migrated === 0 && !page.done) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history migration made no bounded attempt progress."
        );
      }
      migrated += page.migrated;
      if (page.done) {
        return migrated;
      }
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration exceeded its audited attempt bound."
    );
  }
);

/** Runs or resumes the authorized one-attempt transaction series. */
export const runMigration = Effect.fn("tryouts.migration.runIngress")(
  function* (ctx: ActionCtx, request: RunRequest) {
    const started = yield* callInternal(() =>
      ctx.runMutation(beginReference, { migrationId: request.releaseId })
    );
    if (started.phase !== "completed") {
      yield* drainAttempts(
        () =>
          callInternal(() =>
            ctx.runMutation(nextReference, {
              migrationId: request.releaseId,
            })
          ),
        retainedTryoutHistoryPlan.attemptCount
      );
    }
    yield* callInternal(() =>
      ctx.runMutation(finalizeReference, { migrationId: request.releaseId })
    );
    return {
      command: request.command,
      migrationId: request.releaseId,
      status: yield* readMigrationStatus(ctx, request.releaseId),
    };
  }
);
