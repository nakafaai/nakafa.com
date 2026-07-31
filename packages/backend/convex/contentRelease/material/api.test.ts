import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { insertContentViewRoute } from "@repo/backend/test/content-view";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const MATERIAL_PREFIX = "material/lesson/test";
const MATERIAL_CURSOR_PATTERN = /^material-v1:/;

describe("contentRelease/material/api", () => {
  it("reads only source content with a lightweight route projection", async () => {
    const target = convexTest(schema, convexModules);
    const missing = makeMaterialProjection("en", 1);
    const visible = makeMaterialProjection("en", 2);
    await target.mutation(async (ctx) => {
      await insertSourceMaterial(ctx, missing, false);
      await insertSourceMaterial(ctx, visible, true);
    });

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toMatchObject({
      activeReleaseId: null,
      continueCursor: "",
      isDone: true,
      page: [
        {
          item: {
            locale: visible.locale,
            raw: "Source body",
            slug: visible.contentKey,
            sourcePath: visible.contentKey,
            url: `https://nakafa.com/en/${visible.publicPath}`,
          },
          kind: "source",
        },
      ],
    });

    const emptyTarget = convexTest(schema, convexModules);
    const secondMissing = makeMaterialProjection("en", 2);
    await emptyTarget.mutation(async (ctx) => {
      await insertSourceMaterial(ctx, missing, false);
      await insertSourceMaterial(ctx, secondMissing, false);
    });
    await expect(
      emptyTarget.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: null,
      continueCursor: "",
      isDone: true,
      page: [],
    });
  });

  it("replaces one source row with its exact rename and tombstone", async () => {
    const target = convexTest(schema, convexModules);
    const source = makeMaterialProjection("en", 1);
    const renamed = {
      ...source,
      publicPath: PublicPathSchema.make(`${source.parentPath}/renamed`),
    };
    await activateMaterialCatalog(target, [renamed]);
    await selectExactMaterial(target, renamed);
    await target.mutation((ctx) => insertSourceMaterial(ctx, source, true));

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: "",
      isDone: true,
      page: [
        {
          kind: "published",
          locale: "en",
          publicPath: renamed.publicPath,
        },
      ],
    });

    await target.mutation((ctx) =>
      tombstoneMaterial(
        ctx,
        source.contentKey,
        source.locale,
        renamed.publicPath
      )
    );
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: "",
      isDone: true,
      page: [],
    });
  });

  it("skips claimed route rows before hydrating source bodies", async () => {
    const target = convexTest(schema, convexModules);
    const claimed = makeMaterialProjection("en", 1);
    const visible = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, claimed);
    await target.mutation(async (ctx) => {
      await insertSourceRoute(ctx, claimed);
      await insertSourceMaterial(ctx, visible, true);
    });

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toMatchObject({
      page: [
        { kind: "published", publicPath: claimed.publicPath },
        { item: { slug: visible.contentKey }, kind: "source" },
      ],
    });
  });

  it("fails closed when an unclaimed route has no source body", async () => {
    const target = convexTest(schema, convexModules);
    const source = makeMaterialProjection("en", 1);
    await target.mutation((ctx) => insertSourceRoute(ctx, source));

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("paginates family-owned content and resolves its graph route", async () => {
    const target = convexTest(schema, convexModules);
    const first = makeMaterialProjection("en", 1);
    const second = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [first, second]);

    const page = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      locale: "en",
      prefix: MATERIAL_PREFIX,
    });

    expect(page).toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: expect.stringMatching(MATERIAL_CURSOR_PATTERN),
      isDone: false,
      page: [
        {
          kind: "published",
          locale: "en",
          publicPath: first.publicPath,
        },
      ],
    });
    expect(page.continueCursor).not.toBe(first.contentKey);
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: "",
      isDone: true,
      page: [
        {
          kind: "published",
          locale: "en",
          publicPath: second.publicPath,
        },
      ],
    });
    await expect(
      target.query(api.contentRelease.material.apiRoute, {
        input: { contentId: first.graph.assetId, kind: "content" },
      })
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: { locale: first.locale, publicPath: first.publicPath },
      syncedAt: Date.UTC(2026, 6, 23, 12),
    });
  });

  it("rejects a cursor after its locale or active release changes", async () => {
    const target = convexTest(schema, convexModules);
    const first = makeMaterialProjection("en", 1);
    const second = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [first, second]);
    const page = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      locale: "en",
      prefix: MATERIAL_PREFIX,
    });

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        locale: "id",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });

    await advanceMaterialCatalog(target);
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });
  });

  it("keeps sibling prefixes outside source and family pages", async () => {
    const familyTarget = convexTest(schema, convexModules);
    const exact = makeMaterialProjection("en", 1);
    const sibling = makeMaterialProjection("en", 10);
    await activateMaterialCatalog(familyTarget, [exact, sibling]);

    await expect(
      familyTarget.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: exact.contentKey,
      })
    ).resolves.toMatchObject({
      isDone: true,
      page: [{ kind: "published", publicPath: exact.publicPath }],
    });

    const sourceTarget = convexTest(schema, convexModules);
    await sourceTarget.mutation(async (ctx) => {
      await insertSourceMaterial(ctx, exact, true);
      await insertSourceMaterial(ctx, sibling, true);
    });
    await expect(
      sourceTarget.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: exact.contentKey,
      })
    ).resolves.toMatchObject({
      isDone: true,
      page: [{ item: { slug: exact.contentKey }, kind: "source" }],
    });
  });

  it("advances source progress before selecting a later exact key", async () => {
    const target = convexTest(schema, convexModules);
    const exact = makeMaterialProjection("en", 5);
    await activateMaterialCatalog(target, [exact]);
    await selectExactMaterial(target, exact);
    await target.mutation(async (ctx) => {
      for (let order = 1; order <= 4; order += 1) {
        await insertSourceMaterial(
          ctx,
          makeMaterialProjection("en", order),
          order === 4
        );
      }
    });

    const first = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      locale: "en",
      prefix: MATERIAL_PREFIX,
    });
    expect(first).toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: expect.stringMatching(MATERIAL_CURSOR_PATTERN),
      isDone: false,
      page: [
        {
          item: { slug: makeMaterialProjection("en", 4).contentKey },
          kind: "source",
        },
      ],
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: first.continueCursor,
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toMatchObject({
      isDone: true,
      page: [{ kind: "published", publicPath: exact.publicPath }],
    });
  });

  it("keeps unknown graph IDs unmanaged and rejects invalid pages", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query(api.contentRelease.material.apiRoute, {
        input: {
          contentId: "asset:en:material:test:missing",
          kind: "content",
        },
      })
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      route: null,
      syncedAt: null,
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 101,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: "another/prefix",
        limit: 1,
        locale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});

/** Inserts one source-owned material row and its optional graph projection. */
async function insertSourceMaterial(
  ctx: MutationCtx,
  projection: ReturnType<typeof makeMaterialProjection>,
  includeGraph: boolean
) {
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: projection.locale,
    material: "mathematics",
    order: projection.order,
    sectionCount: 1,
    slug: projection.parentPath,
    syncedAt: 0,
    title: projection.topicTitle,
    topic: projection.sectionKey,
  });
  const contentId = await ctx.db.insert("curriculumLessons", {
    body: "Source body",
    contentHash: `source-${projection.contentKey}`,
    date: Date.UTC(2026, 6, 24),
    description: "Source description",
    locale: projection.locale,
    material: "mathematics",
    order: projection.order,
    section: projection.sectionKey,
    slug: projection.contentKey,
    subject: "Technical subject",
    syncedAt: 0,
    title: projection.metadata.title,
    topic: projection.sectionKey,
    topicId,
  });
  const authorId = await ctx.db.insert("authors", {
    name: "Nakafa",
    username: `nakafa-${projection.locale}-${projection.order}`,
  });
  await ctx.db.insert("contentAuthors", {
    authorId,
    contentId,
    contentType: "material",
    order: 0,
  });
  if (includeGraph) {
    await insertSourceRoute(ctx, projection);
  }
}

/** Inserts one lightweight route projection without requiring a source body. */
async function insertSourceRoute(
  ctx: MutationCtx,
  projection: ReturnType<typeof makeMaterialProjection>
) {
  await insertContentViewRoute(ctx, {
    contentId: projection.graph.assetId,
    graph: projection.graph,
    kind: "curriculum-lesson",
    locale: projection.locale,
    materialDomain: "mathematics",
    route: projection.publicPath,
    section: "material",
    sourcePath: projection.contentKey,
    title: projection.metadata.title,
  });
}

/** Converts one selected exact material into its active deletion state. */
async function tombstoneMaterial(
  ctx: MutationCtx,
  contentKey: string,
  locale: "en" | "id",
  publicPath: string
) {
  const head = await ctx.db
    .query("contentHeads")
    .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
      index
        .eq("contentKey", contentKey)
        .eq("locale", locale)
        .eq("sequence", MATERIAL_IDENTITY.sequence)
    )
    .unique();
  const binding = await ctx.db
    .query("contentBindings")
    .withIndex("by_locale_and_publicPath_and_sequence_and_index", (index) =>
      index
        .eq("locale", locale)
        .eq("publicPath", publicPath)
        .eq("sequence", MATERIAL_IDENTITY.sequence)
    )
    .unique();
  if (!(head && binding)) {
    throw new Error("Expected one selected exact material.");
  }
  await ctx.db.patch("contentHeads", head._id, { operation: "delete" });
  await ctx.db.delete("contentBindings", binding._id);
}
