import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  syncArticles,
  verifyArticleBuild,
} from "@repo/backend/convex/contentRelease/article/sync";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { syncMaterials } from "@repo/backend/convex/contentRelease/material/sync";
import { validateMaterialModel } from "@repo/backend/convex/contentRelease/material/validation";
import {
  clearArticleModel,
  copyArticleModel,
} from "@repo/backend/convex/contentRelease/models/article";
import {
  clearMaterialModel,
  copyMaterialModel,
} from "@repo/backend/convex/contentRelease/models/material";
import {
  clearSearchModel,
  copySearchModel,
} from "@repo/backend/convex/contentRelease/models/search";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { validateSearchModel } from "@repo/backend/convex/contentRelease/search/validation";
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
    if (build.phase.startsWith("articleClear")) {
      return yield* clearArticleModel(ctx, build);
    }
    if (build.phase.startsWith("articleCopy")) {
      return yield* copyArticleModel(ctx, build);
    }
    if (build.phase === "articleApply") {
      return yield* syncArticles(ctx, build, release, signed);
    }
    if (build.phase === "articleVerify") {
      return yield* verifyArticleBuild(ctx, build);
    }
    if (build.phase.startsWith("materialClear")) {
      return yield* clearMaterialModel(ctx, build);
    }
    if (build.phase.startsWith("materialCopy")) {
      return yield* copyMaterialModel(ctx, build);
    }
    if (build.phase === "materialApply") {
      return yield* syncMaterials(ctx, build, release, signed);
    }
    if (build.phase === "materialVerify") {
      return yield* validateMaterialModel(ctx, build);
    }
    if (build.phase === "searchClear") {
      return yield* clearSearchModel(ctx, build);
    }
    if (build.phase === "searchCopy") {
      return yield* copySearchModel(ctx, build);
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
