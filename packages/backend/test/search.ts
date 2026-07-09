import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import type { Locale } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { findPublicContentRouteBySourcePath } from "@repo/contents/_types/route/content";
import { Effect, Option } from "effect";
import { expect } from "vitest";

interface ContentSearchFixture {
  contentHash: string;
  description: string;
  locale: Locale;
  markdown_url?: string;
  route: string;
  section: SourceRegistryRoot;
  sourcePath?: string;
  syncedAt: number;
  text: string;
  title: string;
  url?: string;
}

/** Inserts a content search fixture with graph identity as product identity. */
export async function insertContentSearch(
  ctx: MutationCtx,
  fixture: ContentSearchFixture
) {
  const sourcePath = fixture.sourcePath ?? fixture.route;
  const publicPath = getPublicSearchPath(fixture.locale, sourcePath);
  const identity = createLearningGraphIdentityFromRoute({
    locale: fixture.locale,
    route: sourcePath,
  });

  if (!identity) {
    expect.fail(`Expected graph identity for ${sourcePath}.`);
  }

  await ctx.db.insert("contentSearch", {
    ...fixture,
    ...identity,
    content_id: identity.assetId,
    markdown_url:
      fixture.markdown_url ??
      `${NAKAFA_CONTENT_BASE_URL}/${fixture.locale}/${publicPath}.md`,
    route: publicPath,
    sourcePath,
    url:
      fixture.url ??
      `${NAKAFA_CONTENT_BASE_URL}/${fixture.locale}/${publicPath}`,
  });
}

/**
 * Resolves one source path to the localized public search route when projected.
 * Article fixtures already use their public route shape and bypass material
 * route projection so large pagination tests stay focused on Convex search.
 */
export function getPublicSearchPath(locale: Locale, sourcePath: string) {
  if (sourcePath.startsWith("articles/")) {
    return sourcePath;
  }

  const route = Effect.runSync(
    findPublicContentRouteBySourcePath(sourcePath, locale)
  );

  return Option.match(route, {
    onNone: () => sourcePath,
    onSome: (publicRoute) => publicRoute.publicPath,
  });
}

/** Returns the graph asset ID for a search route fixture. */
export function searchContentId(locale: Locale, route: string) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });

  if (!identity) {
    expect.fail(`Expected graph identity for ${route}.`);
  }

  return identity.assetId;
}
