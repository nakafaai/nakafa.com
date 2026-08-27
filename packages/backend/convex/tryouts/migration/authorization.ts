"use node";

import {
  canonicalizeSignedTryoutHistoryMigrationPlan,
  canonicalizeTryoutHistoryMigrationSourceEvidence,
  canonicalizeTryoutHistoryMigrationTargetEvidence,
} from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import { verifySignedTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/verify";
import type { TryoutHistoryMigrationRequest } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { readMigrationSource } from "@repo/backend/convex/tryouts/migration/evidence";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { computeMigrationTarget } from "@repo/backend/convex/tryouts/migration/target";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type PlanRequest = Extract<
  TryoutHistoryMigrationRequest,
  { readonly command: "stagePlan" }
>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;

const stagePlanReference = makeFunctionReference<
  "mutation",
  { migrationId: string; planJson: string },
  MigrationStatus
>("tryouts/migration/plan:stagePlan");

/** Authenticates the exact source, target, and active-key cutover plan. */
export const stageMigrationPlan = Effect.fn(
  "tryouts.migration.stagePlanIngress"
)(function* (
  ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
  request: PlanRequest,
  activeKeyId: string
) {
  const plan = yield* verifySignedTryoutHistoryMigrationPlan(request.plan).pipe(
    Effect.mapError(contractFailure)
  );
  yield* requireActiveContentKey(
    plan.keyId,
    activeKeyId,
    `Try-out history migration plan ${plan.planHash}`
  );
  if (plan.payload.migrationId !== request.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration plan changed its request identity."
    );
  }
  const [source, target] = yield* Effect.all([
    readMigrationSource(ctx),
    computeMigrationTarget(ctx, request.releaseId),
  ]);
  if (
    canonicalizeTryoutHistoryMigrationSourceEvidence(source.evidence) !==
      canonicalizeTryoutHistoryMigrationSourceEvidence(plan.payload.source) ||
    canonicalizeTryoutHistoryMigrationTargetEvidence(target) !==
      canonicalizeTryoutHistoryMigrationTargetEvidence(plan.payload.target)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration plan does not match re-audited storage."
    );
  }
  const status = yield* callInternal(() =>
    ctx.runMutation(stagePlanReference, {
      migrationId: request.releaseId,
      planJson: canonicalizeSignedTryoutHistoryMigrationPlan(plan),
    })
  );
  return {
    command: request.command,
    migrationId: request.releaseId,
    status,
  };
});
