import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { writeMaterial } from "@repo/backend/convex/contentRelease/material/write";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import type { TestConvex } from "convex-test";

export const MATERIAL_IDENTITY = {
  manifestHash: TEST_MANIFEST_HASH,
  releaseId: TEST_RELEASE_ID,
  sequence: 1,
} satisfies TestIdentity;

/** Inserts one projection into the immutable head and active material model. */
export async function insertMaterialProjection(
  ctx: MutationCtx,
  projection: MaterialLessonProjection
) {
  const projectionJson = canonicalizeMaterialProjection(projection);
  const sourcePath = `packages/corpus/${projection.contentKey}/${projection.locale}.mdx`;
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    headReleaseId: MATERIAL_IDENTITY.releaseId,
    headSequence: MATERIAL_IDENTITY.sequence,
    locale: projection.locale,
    projectionJson,
    publicPath: projection.publicPath,
    rendererDomain: "mathematics",
    sourcePath,
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    bindingReleaseId: MATERIAL_IDENTITY.releaseId,
    bindingSequence: MATERIAL_IDENTITY.sequence,
    locale: projection.locale,
    publicPath: projection.publicPath,
  });
  const resolved = await runConvexProgram(
    resolvePublicProjection(
      ctx,
      projection.contentKey,
      projection.locale,
      MATERIAL_IDENTITY.sequence
    )
  );
  if (resolved?.family !== "material") {
    throw new Error("Expected one resolved public material projection.");
  }
  await runConvexProgram(writeMaterial(ctx, resolved, projection));
}

/** Activates a complete locale-parity material catalog for query tests. */
export async function activateMaterialCatalog(
  target: TestConvex<typeof schema>,
  projections: readonly MaterialLessonProjection[] = [
    makeMaterialProjection("en", 1),
    makeMaterialProjection("en", 2),
    makeMaterialProjection("id", 1),
    makeMaterialProjection("id", 2),
  ]
) {
  await target.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...MATERIAL_IDENTITY,
      ownership: { base: [], result: ["material"] },
      role: "candidate",
      status: "completed",
    });
    await insertTestState(ctx, {
      active: MATERIAL_IDENTITY,
      material: MATERIAL_IDENTITY,
      nextSequence: 2,
    });
    for (const projection of projections) {
      await insertMaterialProjection(ctx, projection);
    }
  });
}
