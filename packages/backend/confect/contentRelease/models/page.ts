import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import {
  syncArticles,
  verifyArticleBuild,
} from "@repo/backend/confect/contentRelease/article/sync";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { syncMaterials } from "@repo/backend/confect/contentRelease/material/sync";
import { validateMaterialModel } from "@repo/backend/confect/contentRelease/material/validation";
import { reconcileArticleModel } from "@repo/backend/confect/contentRelease/models/article";
import { reconcileMaterialModel } from "@repo/backend/confect/contentRelease/models/material";
import { reconcileSearchModel } from "@repo/backend/confect/contentRelease/models/search";
import { syncSearch } from "@repo/backend/confect/contentRelease/search/sync";
import { validateSearchModel } from "@repo/backend/confect/contentRelease/search/validation";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;

/** Advances exactly one bounded inactive-buffer phase page. */
export const advanceModelPage = Effect.fn("contentRelease.advanceModelPage")(
  function* (
    ctx: MutationCtx,
    build: ModelBuild,
    release: Doc<"contentReleases">,
    signed: SignedContentRelease
  ) {
    if (
      build.phase === "articleCatalog" ||
      build.phase === "articleCategories" ||
      build.phase === "articleBuckets"
    ) {
      return yield* reconcileArticleModel(ctx, build);
    }
    if (build.phase === "articleApply") {
      return yield* syncArticles(ctx, build, release, signed);
    }
    if (build.phase === "articleVerify") {
      return yield* verifyArticleBuild(ctx, build);
    }
    if (
      build.phase === "materialCatalog" ||
      build.phase === "materialBuckets"
    ) {
      return yield* reconcileMaterialModel(ctx, build);
    }
    if (build.phase === "materialApply") {
      return yield* syncMaterials(ctx, build, release, signed);
    }
    if (build.phase === "materialVerify") {
      return yield* validateMaterialModel(ctx, build);
    }
    if (build.phase === "search") {
      return yield* reconcileSearchModel(ctx, build);
    }
    if (build.phase === "searchApply") {
      return yield* syncSearch(ctx, build, release, signed);
    }
    if (build.phase === "searchVerify") {
      return yield* validateSearchModel(ctx, build, release);
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Model build ${build.releaseId} cannot advance phase ${build.phase}.`
    );
  }
);
