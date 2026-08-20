import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
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

const NEXT_MATERIAL_IDENTITY = {
  manifestHash: Sha256HashSchema.make(`sha256:${"3".repeat(64)}`),
  releaseId: ReleaseIdSchema.make("release-next"),
  sequence: 2,
} satisfies TestIdentity;

/** Inserts one projection into the immutable head and active material model. */
export async function insertMaterialProjection(
  ctx: MutationCtx,
  projection: MaterialLessonProjection,
  identity: TestIdentity = MATERIAL_IDENTITY
) {
  const projectionJson = canonicalizeMaterialProjection(projection);
  const sourcePath = `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`;
  await insertRuntimeVersion(ctx, "public", projection.contentKey, {
    artifactLocale: projection.artifactLocale,
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    projectionJson,
    publicPath: projection.publicPath,
    rendererDomain: "mathematics",
    sourcePath,
  });
  await insertRuntimeBinding(ctx, projection.contentKey, {
    appLocale: projection.appLocale,
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath: projection.publicPath,
  });
  const resolved = await runConvexProgram(
    resolvePublicProjection(
      ctx,
      projection.contentKey,
      projection.artifactLocale,
      identity.sequence
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
  ],
  activeAppLocales: readonly ActiveAppLocaleCode[] = ["en", "id"]
) {
  await target.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...MATERIAL_IDENTITY,
      activeAppLocales,
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

/** Advances the active material pointer without reusing the prior generation. */
export async function advanceMaterialCatalog(
  target: TestConvex<typeof schema>
) {
  await target.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...NEXT_MATERIAL_IDENTITY,
      activeAppLocales: ["en", "id"],
      base: MATERIAL_IDENTITY,
      ownership: { base: ["material"], result: ["material"] },
      role: "candidate",
      status: "completed",
    });
    const state = await ctx.db.query("contentState").unique();
    if (!state) {
      throw new Error("Expected one active content state.");
    }
    await ctx.db.patch("contentState", state._id, {
      activeManifestHash: NEXT_MATERIAL_IDENTITY.manifestHash,
      activeReleaseId: NEXT_MATERIAL_IDENTITY.releaseId,
      activeSequence: NEXT_MATERIAL_IDENTITY.sequence,
      materialManifestHash: NEXT_MATERIAL_IDENTITY.manifestHash,
      materialReleaseId: NEXT_MATERIAL_IDENTITY.releaseId,
      materialSequence: NEXT_MATERIAL_IDENTITY.sequence,
      nextSequence: 3,
    });
  });
}
