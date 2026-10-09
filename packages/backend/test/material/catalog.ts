import { assert } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { writeMaterial } from "@repo/backend/confect/contentRelease/material/write";
import { INITIAL_MODEL_SLOT } from "@repo/backend/confect/contentRelease/models/slot";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testTextHash,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";
import { Array as Arr, Effect } from "effect";
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
const defaultMaterialProjections = Arr.flatMap(
  ACTIVE_APP_LOCALE_CODES,
  (appLocale) => [
    makeMaterialProjection(appLocale, 1),
    makeMaterialProjection(appLocale, 2),
  ]
);

/** Inserts one projection into the immutable head and active material model. */
export const insertMaterialProjection = Effect.fn(
  "TestMaterial.insertProjection"
)(function* (
  projection: MaterialLessonProjection,
  identity: TestIdentity = MATERIAL_IDENTITY
) {
  const ctx = yield* MutationCtx;
  const projectionJson = canonicalizeMaterialProjection(projection);
  const sourcePath = `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`;
  yield* Effect.promise(() =>
    insertRuntimeVersion(ctx, "public", projection.contentKey, {
      artifactHash: testTextHash(
        `${projection.contentKey}/${projection.artifactLocale}/${identity.sequence}`
      ),
      artifactLocale: projection.artifactLocale,
      headReleaseId: identity.releaseId,
      headSequence: identity.sequence,
      projectionJson,
      publicPath: projection.publicPath,
      rendererDomain: "mathematics",
      sourcePath,
    })
  );
  yield* Effect.promise(() =>
    insertRuntimeBinding(ctx, projection.contentKey, {
      appLocale: projection.appLocale,
      bindingReleaseId: identity.releaseId,
      bindingSequence: identity.sequence,
      publicPath: projection.publicPath,
    })
  );
  const resolved = yield* resolvePublicProjection(
    projection.contentKey,
    projection.artifactLocale,
    identity.sequence
  ).pipe(Effect.provide(publicationLayer));
  assert(resolved?.family === "material");
  yield* writeMaterial(INITIAL_MODEL_SLOT, resolved, projection);
});

/** Activates a complete locale-parity material catalog for query tests. */
export const activateMaterialCatalog = Effect.fn(
  "TestMaterial.activateCatalog"
)(function* (
  projections: readonly MaterialLessonProjection[] = defaultMaterialProjections,
  activeAppLocales: readonly ActiveAppLocaleCode[] = ACTIVE_APP_LOCALE_CODES
) {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(() =>
    insertZeroRelease(ctx, {
      ...MATERIAL_IDENTITY,
      activeAppLocales,
      ownership: { base: [], result: ["material"] },
      role: "candidate",
      status: "completed",
    })
  );
  yield* Effect.promise(() =>
    insertTestState(ctx, {
      active: MATERIAL_IDENTITY,
      material: MATERIAL_IDENTITY,
      nextSequence: 2,
    })
  );
  for (const projection of projections) {
    yield* insertMaterialProjection(projection);
  }
});

/** Advances the active material pointer without reusing the prior generation. */
export const advanceMaterialCatalog = Effect.fn("TestMaterial.advanceCatalog")(
  function* () {
    const ctx = yield* MutationCtx;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    yield* Effect.promise(() =>
      insertZeroRelease(ctx, {
        ...NEXT_MATERIAL_IDENTITY,
        activeAppLocales: ACTIVE_APP_LOCALE_CODES,
        base: MATERIAL_IDENTITY,
        ownership: { base: ["material"], result: ["material"] },
        role: "candidate",
        status: "completed",
      })
    );
    const state = yield* reader.table("contentState").get("by_key", "primary");
    yield* writer.table("contentState").patch(state._id, {
      activeManifestHash: NEXT_MATERIAL_IDENTITY.manifestHash,
      activeReleaseId: NEXT_MATERIAL_IDENTITY.releaseId,
      activeSequence: NEXT_MATERIAL_IDENTITY.sequence,
      materialManifestHash: NEXT_MATERIAL_IDENTITY.manifestHash,
      materialReleaseId: NEXT_MATERIAL_IDENTITY.releaseId,
      materialSequence: NEXT_MATERIAL_IDENTITY.sequence,
      nextSequence: 3,
    });
  }
);
