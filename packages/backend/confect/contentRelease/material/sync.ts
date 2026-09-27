import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/confect/contentRelease/material/write";
import { loadModelItems } from "@repo/backend/confect/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/confect/contentRelease/models/spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { Effect } from "effect";

type ModelBuild = Docs["contentModelBuilds"];

/** Applies one release identity to the inactive material buffer. */
const syncMaterialIdentity = Effect.fn("contentRelease.syncMaterialIdentity")(
  function* (
    build: ModelBuild,
    contentKey: string,
    artifactLocale: Docs["contentKeys"]["artifactLocale"]
  ) {
    const resolved = yield* resolvePublicProjection(
      contentKey,
      artifactLocale,
      build.sequence
    ).pipe(Effect.provide(publicationLayer));
    if (resolved?.projection.kind !== "subject-lesson") {
      return yield* deleteMaterial(
        build.slots.materialTargetSlot,
        contentKey,
        artifactLocale
      );
    }
    yield* writeMaterial(
      build.slots.materialTargetSlot,
      resolved,
      resolved.projection
    );
  }
);

/** Applies one bounded release page to the inactive material buffer. */
export const syncMaterials = Effect.fn("contentRelease.syncMaterials")(
  function* (
    build: ModelBuild,
    release: Docs["contentReleases"],
    signed: SignedContentRelease
  ) {
    const page = yield* loadModelItems(release, signed, build.itemIndex);
    for (const row of page.rows) {
      yield* syncMaterialIdentity(build, row.contentKey, row.artifactLocale);
    }
    return {
      done: page.done,
      itemIndex: page.nextIndex,
      processed: page.rows.length,
    } satisfies ModelBuildPage;
  }
);
