import type {
  PublicContentRuntimeFound,
  PublicContentRuntimeRequest,
} from "@nakafa/aksara-contracts/runtime/spec";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import {
  MAX_MATERIAL_RUNTIME_RESPONSE_BYTES,
  MaterialRuntimeResponseSchema,
} from "@repo/backend/content/material";
import { publicRuntimeBytes } from "@repo/backend/content/runtime";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { MaterialRuntimeRow } from "@repo/backend/convex/contentRelease/material/runtime";
import {
  decodePublicRequest,
  decodePublicRuntimeFound,
} from "@repo/backend/convex/contentRelease/runtime/public/dispatch";
import {
  encodeRuntimeResult,
  failureResult,
} from "@repo/backend/convex/contentRelease/runtime/result";
import { makeFunctionReference } from "convex/server";
import { Effect, Result, Schema } from "effect";

const materialReadReference = makeFunctionReference<
  "query",
  Pick<PublicContentRuntimeRequest, "appLocale" | "publicPath">,
  MaterialRuntimeRow
>("contentRelease/material/runtime:read");

/** Cohesive material state could not be read or decoded safely. */
class MaterialRuntimeReadError extends Schema.TaggedError<MaterialRuntimeReadError>()(
  "MaterialRuntimeReadError",
  {}
) {}

/** Decodes one raw cohesive row without weakening the Aksara runtime contract. */
export const decodeMaterialRow = Effect.fn(
  "contentRelease.decodeMaterialRuntimeRow"
)(function* (row: MaterialRuntimeRow) {
  if (row.model.projectionJson === null && row.runtime === null) {
    return null;
  }
  if (
    row.model.projectionJson === null ||
    row.model.rendererDomain === null ||
    row.model.sourcePath === null ||
    row.runtime === null ||
    row.runtime.activeManifestHash !== row.model.activeManifestHash ||
    row.runtime.activeReleaseId !== row.model.activeReleaseId ||
    row.runtime.projectionJson !== row.model.projectionJson ||
    row.runtime.sourcePath !== row.model.sourcePath
  ) {
    return yield* new MaterialRuntimeReadError();
  }
  const runtime = yield* decodePublicRuntimeFound(row.runtime).pipe(
    Effect.mapError(() => new MaterialRuntimeReadError())
  );
  return {
    kind: "found",
    model: row.model,
    runtime: runtime satisfies PublicContentRuntimeFound,
  };
});

/** Reads one cohesive material row through one internal query transaction. */
const resolveMaterialRuntime = Effect.fn(
  "contentRelease.resolveMaterialRuntime"
)(function* (ctx: ActionCtx, request: PublicContentRuntimeRequest) {
  const row = yield* Effect.tryPromise({
    catch: () => new MaterialRuntimeReadError(),
    try: (): Promise<MaterialRuntimeRow> =>
      ctx.runQuery(materialReadReference, {
        appLocale: request.appLocale,
        publicPath: request.publicPath,
      }),
  });
  return yield* decodeMaterialRow(row);
});

/** Decodes, resolves, and encodes one cohesive material request. */
export const dispatchMaterialProgram = Effect.fn(
  "contentRelease.dispatchMaterialRuntime"
)(function* (ctx: ActionCtx, source: string, byteLength: number) {
  const decoded = yield* decodePublicRequest(source, byteLength).pipe(
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    return failureResult("CONTENT_RUNTIME_INVALID", 400);
  }
  const resolved = yield* resolveMaterialRuntime(ctx, decoded.success).pipe(
    Effect.result
  );
  if (Result.isFailure(resolved)) {
    return failureResult("CONTENT_RUNTIME_INTERNAL", 500);
  }
  if (
    resolved.success !== null &&
    publicRuntimeBytes(resolved.success.runtime) >
      MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
  ) {
    return failureResult("CONTENT_RUNTIME_RESPONSE_TOO_LARGE", 500);
  }
  return encodeRuntimeResult(
    MaterialRuntimeResponseSchema,
    MAX_MATERIAL_RUNTIME_RESPONSE_BYTES,
    resolved.success ?? { kind: "missing" },
    resolved.success === null ? 404 : 200
  );
});
