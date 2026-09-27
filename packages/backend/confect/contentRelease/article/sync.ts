import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { validateArticleModel } from "@repo/backend/confect/contentRelease/article/validation";
import {
  deleteArticle,
  writeArticle,
} from "@repo/backend/confect/contentRelease/article/write";
import { loadModelItems } from "@repo/backend/confect/contentRelease/models/items";
import type { ModelBuildPage } from "@repo/backend/confect/contentRelease/models/spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { Effect } from "effect";

type ModelBuild = Docs["contentModelBuilds"];
type Release = Docs["contentReleases"];

/** Resolves one changed identity against the effective active release. */
const resolveArticleChange = Effect.fn("contentRelease.resolveArticleChange")(
  function* (row: Docs["contentItems"], activeSequence: number) {
    const resolved = yield* resolvePublicProjection(
      row.contentKey,
      row.artifactLocale,
      activeSequence
    ).pipe(Effect.provide(publicationLayer));
    if (resolved?.projection.kind !== "article") {
      return null;
    }
    return {
      projection: resolved.projection,
      resolved,
    };
  }
);

/** Synchronizes one changed identity into the active article read model. */
const syncArticleItem = Effect.fn("contentRelease.syncArticleItem")(function* (
  build: ModelBuild,
  row: Docs["contentItems"],
  activeSequence: number
) {
  const change = yield* resolveArticleChange(row, activeSequence);
  if (!change) {
    return yield* deleteArticle(
      build.slots.articleTargetSlot,
      row.contentKey,
      row.artifactLocale
    );
  }
  yield* writeArticle(
    build.slots.articleTargetSlot,
    {
      ...change.resolved,
      delivery: "public",
      operation: "upsert",
    },
    change.projection
  );
});

/** Advances staging and final-model validation through durable bounded pages. */
export const syncArticles = Effect.fn("contentRelease.syncArticles")(function* (
  build: ModelBuild,
  release: Release,
  signed: SignedContentRelease
) {
  const page = yield* loadModelItems(release, signed, build.itemIndex);
  for (const row of page.rows) {
    yield* syncArticleItem(build, row, release.sequence);
  }
  return {
    done: page.done,
    itemIndex: page.nextIndex,
    processed: page.rows.length,
  } satisfies ModelBuildPage;
});

/** Validates one bounded page of the completed inactive article buffer. */
export const verifyArticleBuild = Effect.fn(
  "contentRelease.verifyArticleBuild"
)(function* (build: ModelBuild) {
  return yield* validateArticleModel(
    build.slots.articleTargetSlot,
    build.cursor,
    build.sequence
  );
});
