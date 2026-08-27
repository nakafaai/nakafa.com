"use node";

import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type { abortResultValidator } from "@repo/backend/convex/tryouts/migration/abort";
import { stageMigrationPlan } from "@repo/backend/convex/tryouts/migration/authorization";
import {
  stageMigrationArtifacts,
  stageMigrationBundle,
  stageMigrationSnapshot,
} from "@repo/backend/convex/tryouts/migration/bundle";
import { readMigrationSource } from "@repo/backend/convex/tryouts/migration/evidence";
import {
  readMigrationArtifactBatch,
  readMigrationRowPage,
} from "@repo/backend/convex/tryouts/migration/read";
import {
  cleanupMigrationReceipt,
  sealMigrationReceipt,
} from "@repo/backend/convex/tryouts/migration/receipt";
import { stageMigrationRows } from "@repo/backend/convex/tryouts/migration/rows";
import { runMigration } from "@repo/backend/convex/tryouts/migration/run";
import type { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { readMigrationStatus } from "@repo/backend/convex/tryouts/migration/status";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type MigrationRequest = Extract<
  PublicationRequest,
  { readonly operation: "migrateTryoutHistory" }
>;
type MigrationStatus = Infer<typeof migrationStatusValidator>;
type AbortResult = Infer<typeof abortResultValidator>;

const initializeReference = makeFunctionReference<
  "mutation",
  { migrationId: string; sourceSnapshotId: string },
  MigrationStatus
>("tryouts/migration/state/store:initialize");
const abortReference = makeFunctionReference<
  "mutation",
  { migrationId: string },
  AbortResult
>("tryouts/migration/abort:abort");
/** Routes one authenticated temporary migration command to its owner. */
export const migrateTryoutHistory = Effect.fn(
  "contentRelease.migrateTryoutHistory"
)(function* (ctx: ActionCtx, request: MigrationRequest, activeKeyId: string) {
  if (request.command === "source") {
    return {
      ok: true,
      operation: request.operation,
      value: {
        command: request.command,
        migrationId: request.releaseId,
        source: yield* readMigrationSource(ctx),
      },
    };
  }
  if (request.command === "initialize") {
    const status = yield* callInternal(() =>
      ctx.runMutation(initializeReference, {
        migrationId: request.releaseId,
        sourceSnapshotId: request.sourceSnapshotId,
      })
    );
    return {
      ok: true,
      operation: request.operation,
      value: {
        command: request.command,
        migrationId: request.releaseId,
        status,
      },
    };
  }
  if (request.command === "abort") {
    const value = yield* callInternal(() =>
      ctx.runMutation(abortReference, { migrationId: request.releaseId })
    );
    return {
      ok: true,
      operation: request.operation,
      value: { command: request.command, ...value },
    };
  }
  if (request.command === "rowPage") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* readMigrationRowPage(ctx, request),
    };
  }
  if (request.command === "artifactBatch") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* readMigrationArtifactBatch(ctx, request),
    };
  }
  if (request.command === "stageBundle") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* stageMigrationBundle(ctx, request, activeKeyId),
    };
  }
  if (request.command === "stageArtifacts") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* stageMigrationArtifacts(ctx, request, activeKeyId),
    };
  }
  if (request.command === "stageRows") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* stageMigrationRows(ctx, request),
    };
  }
  if (request.command === "stageSnapshot") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* stageMigrationSnapshot(ctx, request),
    };
  }
  if (request.command === "stagePlan") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* stageMigrationPlan(ctx, request, activeKeyId),
    };
  }
  if (request.command === "run") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* runMigration(ctx, request),
    };
  }
  if (request.command === "seal") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* sealMigrationReceipt(ctx, request, activeKeyId),
    };
  }
  if (request.command === "cleanup") {
    return {
      ok: true,
      operation: request.operation,
      value: yield* cleanupMigrationReceipt(ctx, request),
    };
  }
  return {
    ok: true,
    operation: request.operation,
    value: {
      command: request.command,
      migrationId: request.releaseId,
      status: yield* readMigrationStatus(ctx, request.releaseId),
    },
  };
});
