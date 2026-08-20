import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  MaterialKeySchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect, Schema } from "effect";
/** Stable signed material identity requested by an application surface. */
export interface MaterialIdentityInput {
  readonly appLocale: Doc<"materialCatalog">["appLocale"];
  readonly contentKey: string;
  readonly expectedMaterialKey: string;
  readonly expectedSectionKey: string;
}
/** Decodes the caller's stable identity through Aksara's current contracts. */
const decodeMaterialIdentity = Effect.fn(
  "contentRelease.decodeMaterialIdentity"
)(function* (input: MaterialIdentityInput) {
  return yield* Effect.all({
    contentKey: Schema.decodeEffect(ContentKeySchema)(input.contentKey),
    materialKey: Schema.decodeEffect(MaterialKeySchema)(
      input.expectedMaterialKey
    ),
    sectionKey: Schema.decodeEffect(MaterialSectionSchema)(
      input.expectedSectionKey
    ),
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_LIMIT",
          message:
            "Material identity must satisfy the current Aksara contract.",
        })
    )
  );
});
/** Resolves one active authenticated material row by stable content identity. */
export const readMaterialIdentity = Effect.fn(
  "contentRelease.readMaterialIdentity"
)(function* (ctx: QueryCtx, input: MaterialIdentityInput) {
  const [identity, owner] = yield* Effect.all([
    decodeMaterialIdentity(input),
    loadMaterialOwner(ctx, input.appLocale),
  ]);
  if (!(owner.active && owner.managed)) {
    return {
      activeReleaseId: owner.active?.releaseId ?? null,
      managed: false,
      publicPath: null,
    };
  }
  const row = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_contentKey_and_appLocale", (index) =>
        index
          .eq("contentKey", identity.contentKey)
          .eq("appLocale", input.appLocale)
      )
      .unique()
  );
  if (!row) {
    return {
      activeReleaseId: owner.active.releaseId,
      managed: true,
      publicPath: null,
    };
  }
  const { projection } = yield* verifyEffectiveMaterial(
    ctx,
    row,
    owner.active.sequence
  );
  if (
    projection.materialKey !== identity.materialKey ||
    projection.sectionKey !== identity.sectionKey
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active material ${identity.contentKey}/${input.appLocale} disagrees with its stable identity.`
    );
  }
  return {
    activeReleaseId: owner.active.releaseId,
    managed: true,
    publicPath: projection.publicPath,
  };
});
