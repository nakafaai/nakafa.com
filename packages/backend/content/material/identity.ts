import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  MaterialKeySchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { Effect, Option, Schema } from "effect";

const MaterialIdentityInputSchema = Schema.Struct({
  appLocale: appLocaleValidator,
  contentKey: Schema.String,
  expectedMaterialKey: Schema.String,
  expectedSectionKey: Schema.String,
});
/** Stable signed material identity requested by an application surface. */
type MaterialIdentityInput = typeof MaterialIdentityInputSchema.Type;
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
    Effect.mapError(() =>
      ReleaseError.make({
        code: "CONTENT_RELEASE_LIMIT",
        message: "Material identity must satisfy the current Aksara contract.",
      })
    )
  );
});
/** Resolves one active authenticated material row by stable content identity. */
export const readMaterialIdentity = Effect.fn(
  "contentRelease.readMaterialIdentity"
)(function* (input: MaterialIdentityInput) {
  const [identity, owner] = yield* Effect.all([
    decodeMaterialIdentity(input),
    loadMaterialOwner(input.appLocale),
  ]);
  if (!(owner.active && owner.managed && owner.slot)) {
    return {
      activeReleaseId: owner.active?.releaseId ?? null,
      managed: false,
      publicPath: null,
    };
  }
  const row = Option.getOrNull(
    yield* (yield* MaterialSource).material(
      owner.slot,
      identity.contentKey,
      input.appLocale
    )
  );
  if (!row) {
    return {
      activeReleaseId: owner.active.releaseId,
      managed: true,
      publicPath: null,
    };
  }
  const { projection } = yield* verifyEffectiveMaterial(
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
