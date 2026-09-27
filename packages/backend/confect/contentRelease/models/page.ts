import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
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
import { Effect } from "effect";

type ModelBuild = Docs["contentModelBuilds"];

/** Advances exactly one bounded inactive-buffer phase page. */
export const advanceModelPage = Effect.fn("contentRelease.advanceModelPage")(
  function* (
    build: ModelBuild,
    release: Docs["contentReleases"],
    signed: SignedContentRelease
  ) {
    if (
      build.phase === "articleCatalog" ||
      build.phase === "articleCategories" ||
      build.phase === "articleBuckets"
    ) {
      return yield* reconcileArticleModel(build);
    }
    if (build.phase === "articleApply") {
      return yield* syncArticles(build, release, signed);
    }
    if (build.phase === "articleVerify") {
      return yield* verifyArticleBuild(build);
    }
    if (
      build.phase === "materialCatalog" ||
      build.phase === "materialBuckets"
    ) {
      return yield* reconcileMaterialModel(build);
    }
    if (build.phase === "materialApply") {
      return yield* syncMaterials(build, release, signed);
    }
    if (build.phase === "materialVerify") {
      return yield* validateMaterialModel(build);
    }
    if (build.phase === "search") {
      return yield* reconcileSearchModel(build);
    }
    if (build.phase === "searchApply") {
      return yield* syncSearch(build, release, signed);
    }
    if (build.phase === "searchVerify") {
      return yield* validateSearchModel(build, release);
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Model build ${build.releaseId} cannot advance phase ${build.phase}.`
    );
  }
);
