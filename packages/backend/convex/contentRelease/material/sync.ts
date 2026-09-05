import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  deleteMaterial,
  writeMaterial,
} from "@repo/backend/convex/contentRelease/material/write";
import { loadModelItems } from "@repo/backend/convex/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/convex/contentRelease/models/spec";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;

/** Applies one release identity to the inactive material buffer. */
const syncMaterialIdentity = Effect.fn("contentRelease.syncMaterialIdentity")(
  function* (
    ctx: MutationCtx,
    build: ModelBuild,
    contentKey: string,
    artifactLocale: Doc<"contentKeys">["artifactLocale"]
  ) {
    const resolved = yield* resolvePublicProjection(
      contentKey,
      artifactLocale,
      build.sequence
    ).pipe(Effect.provide(convexPublicationLayer(ctx)));
    if (resolved?.projection.kind !== "subject-lesson") {
      return yield* deleteMaterial(
        ctx,
        build.slots.materialTargetSlot,
        contentKey,
        artifactLocale
      );
    }
    yield* writeMaterial(
      ctx,
      build.slots.materialTargetSlot,
      resolved,
      resolved.projection
    );
  }
);

/** Applies one bounded release page to the inactive material buffer. */
export const syncMaterials = Effect.fn("contentRelease.syncMaterials")(
  function* (
    ctx: MutationCtx,
    build: ModelBuild,
    release: Doc<"contentReleases">,
    signed: SignedContentRelease
  ) {
    const page = yield* loadModelItems(ctx, release, signed, build.itemIndex);
    for (const row of page.rows) {
      yield* syncMaterialIdentity(
        ctx,
        build,
        row.contentKey,
        row.artifactLocale
      );
    }
    return {
      done: page.done,
      itemIndex: page.nextIndex,
      processed: page.rows.length,
    } satisfies ModelBuildPage;
  }
);
