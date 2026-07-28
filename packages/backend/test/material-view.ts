import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { RecordContentViewArgs } from "@repo/backend/convex/contents/views/spec";
import {
  type createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content-material";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { PublicCurriculumRouteSchema } from "@repo/contents/_types/route/schema";
import { Schema } from "effect";

export const PLACEMENT_VIEW_NOW = Date.UTC(2026, 6, 13, 2, 0, 0);
const SOURCE_PATH = "material/lesson/biology/biodiversity/bacteria";
const PUBLIC_TOPIC_PATH = "materi/biologi/keanekaragaman-makhluk-hidup";
export const PUBLIC_LESSON_PATH = `${PUBLIC_TOPIC_PATH}/bakteri`;
const MATERIAL_KEY = "lesson.biology.biodiversity";
export const PROGRAM_KEY = "cambridge-international";
export const CONTEXT_NODE_KEY = "biology-0610-living-organisms";
export const CONTEXT_PUBLIC_PATH =
  "kurikulum/cambridge-international/upper-secondary/biology-0610/karakteristik-dan-klasifikasi-organisme-hidup";
export const CONTEXT_PARENT_PATH =
  "kurikulum/cambridge-international/upper-secondary/biology-0610";
export const PUBLISHED_MATERIAL = FUNCTION_MATERIAL;
export const RENAMED_MATERIAL = MaterialLessonProjectionSchema.make({
  ...PUBLISHED_MATERIAL,
  publicPath: PublicPathSchema.make(
    `${PUBLISHED_MATERIAL.parentPath}/function-concept-renamed`
  ),
});
export const LATEST_MATERIAL = MaterialLessonProjectionSchema.make({
  ...RENAMED_MATERIAL,
  parentPath: PublicPathSchema.make(`${PUBLISHED_MATERIAL.parentPath}-renamed`),
  publicPath: PublicPathSchema.make(
    `${PUBLISHED_MATERIAL.parentPath}-renamed/function-concept-current`
  ),
});
const publishedPlacement = readStaticPublicCurriculumRoutes().find(
  (route) =>
    route.locale === PUBLISHED_MATERIAL.locale &&
    route.materialKey === PUBLISHED_MATERIAL.materialKey &&
    route.materialContextNodeKey !== undefined
);
if (!publishedPlacement) {
  throw new Error("Expected the real Function Concept curriculum placement.");
}
export const PUBLISHED_PLACEMENT = Schema.decodeUnknownSync(
  PublicCurriculumRouteSchema
)(publishedPlacement);
export const PUBLISHED_CONTEXT_NODE =
  PUBLISHED_PLACEMENT.materialContextNodeKey;
export const PUBLISHED_CANONICAL_PATH = Schema.decodeUnknownSync(Schema.String)(
  PUBLISHED_PLACEMENT.canonicalPath
);
if (!PUBLISHED_CONTEXT_NODE) {
  throw new Error("Expected the real curriculum placement route identity.");
}

/** Inserts one production-shaped material route and its exact placement leaf. */
export async function seedMaterialPlacement(ctx: MutationCtx) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: SOURCE_PATH,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${SOURCE_PATH}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [],
    contentHash: "content-route-hash",
    content_id: identity.assetId,
    description: "Mengenali bakteri",
    kind: "curriculum-lesson",
    locale: "id",
    markdown: true,
    materialDomain: "biology",
    route: PUBLIC_LESSON_PATH,
    section: "material",
    sourcePath: SOURCE_PATH,
    syncedAt: PLACEMENT_VIEW_NOW,
    title: "Bakteri",
  });

  await ctx.db.insert("publicRoutes", {
    contentHash: "public-material-route-hash",
    kind: "subject-lesson",
    locale: "id",
    materialDomain: "biology",
    materialKey: MATERIAL_KEY,
    parentPath: PUBLIC_TOPIC_PATH,
    publicPath: PUBLIC_LESSON_PATH,
    sitemap: true,
    sourcePath: SOURCE_PATH,
    syncShard: 0,
    title: "Bakteri",
  });

  const placementId = await ctx.db.insert("publicRoutes", {
    canonicalPath: PUBLIC_TOPIC_PATH,
    contentHash: "curriculum-placement-route-hash",
    kind: "curriculum-context",
    locale: "id",
    materialContextNodeKey: CONTEXT_NODE_KEY,
    materialContextParentPath: CONTEXT_PARENT_PATH,
    materialContextPublicPath: CONTEXT_PUBLIC_PATH,
    materialKey: MATERIAL_KEY,
    nodeKey: `${CONTEXT_NODE_KEY}-material`,
    parentPath: CONTEXT_PUBLIC_PATH,
    programKey: PROGRAM_KEY,
    publicPath: `${CONTEXT_PUBLIC_PATH}/bakteri`,
    sitemap: false,
    syncShard: 0,
    title: "Bakteri",
  });

  const viewer = await seedAuthenticatedUser(ctx, {
    now: PLACEMENT_VIEW_NOW,
    suffix: "material-context",
  });

  return { ...viewer, contentId: identity.assetId, placementId };
}

/** Inserts source placement rows for one material already owned by Aksara. */
export async function seedMixedPlacement(
  ctx: MutationCtx,
  canonicalPath = PUBLISHED_CANONICAL_PATH
) {
  await ctx.db.insert("publicRoutes", {
    contentHash: "published-material-source-route",
    kind: PUBLISHED_MATERIAL.kind,
    locale: PUBLISHED_MATERIAL.locale,
    materialDomain: "mathematics",
    materialKey: PUBLISHED_MATERIAL.materialKey,
    order: PUBLISHED_MATERIAL.order,
    parentPath: PUBLISHED_MATERIAL.parentPath,
    publicPath: PUBLISHED_MATERIAL.publicPath,
    sectionKey: PUBLISHED_MATERIAL.sectionKey,
    sitemap: PUBLISHED_MATERIAL.sitemap,
    sourcePath: PUBLISHED_MATERIAL.contentKey,
    syncShard: 0,
    title: PUBLISHED_MATERIAL.metadata.title,
  });
  await ctx.db.insert("publicRoutes", {
    ...PUBLISHED_PLACEMENT,
    canonicalPath,
    contentHash: "published-material-source-placement",
    syncShard: 0,
  });
  return seedAuthenticatedUser(ctx, {
    now: PLACEMENT_VIEW_NOW,
    suffix: "published-material-context",
  });
}

/** Inserts the renamed source route before its previous shard is reconciled. */
export async function seedRouteSyncOverlap(ctx: MutationCtx) {
  await ctx.db.insert("publicRoutes", {
    contentHash: "renamed-material-source-route",
    kind: RENAMED_MATERIAL.kind,
    locale: RENAMED_MATERIAL.locale,
    materialDomain: "mathematics",
    materialKey: RENAMED_MATERIAL.materialKey,
    order: RENAMED_MATERIAL.order,
    parentPath: RENAMED_MATERIAL.parentPath,
    publicPath: RENAMED_MATERIAL.publicPath,
    sectionKey: RENAMED_MATERIAL.sectionKey,
    sitemap: RENAMED_MATERIAL.sitemap,
    sourcePath: RENAMED_MATERIAL.contentKey,
    syncShard: 1,
    title: RENAMED_MATERIAL.metadata.title,
  });
}

/** Builds the renamed context shard for one canonical material route. */
function makeContextOverlap(canonicalPath: string) {
  return {
    ...PUBLISHED_PLACEMENT,
    canonicalPath,
    contentHash: "renamed-material-source-placement",
    publicPath: `${PUBLISHED_PLACEMENT.publicPath}-renamed`,
    syncShard: 1,
  };
}

/** Inserts an equivalent context row before its previous shard is reconciled. */
export async function seedContextRouteOverlap(ctx: MutationCtx) {
  await ctx.db.insert(
    "publicRoutes",
    makeContextOverlap(PUBLISHED_CANONICAL_PATH)
  );
}

/** Inserts a conflicting context owner beside the still-active route shard. */
export async function seedContextOwnershipConflict(ctx: MutationCtx) {
  await ctx.db.insert("publicRoutes", {
    ...makeContextOverlap(PUBLISHED_CANONICAL_PATH),
    materialContextPublicPath: PUBLISHED_PLACEMENT.publicPath,
  });
}

/** Inserts overlapping source and context rows owned by the renamed route. */
export async function seedContextSyncOverlap(ctx: MutationCtx) {
  await seedRouteSyncOverlap(ctx);
  await ctx.db.insert(
    "publicRoutes",
    makeContextOverlap(RENAMED_MATERIAL.publicPath)
  );
}

/** Builds one view request for the real published Function Concept lesson. */
function publishedViewArgs(
  deviceId: string,
  publicPath: string
): RecordContentViewArgs {
  return {
    contentId: PUBLISHED_MATERIAL.graph.assetId,
    context: {
      mode: "placement",
      nodeKey: PUBLISHED_CONTEXT_NODE,
      programKey: PUBLISHED_PLACEMENT.programKey,
    },
    deviceId,
    locale: PUBLISHED_MATERIAL.locale,
    publicPath,
    section: "material",
  };
}

/** Records one authenticated view of the real published Function Concept. */
export function recordPublishedView(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  viewer: Awaited<ReturnType<typeof seedMixedPlacement>>,
  deviceId: string,
  publicPath: string
) {
  return t
    .withIdentity({
      sessionId: viewer.sessionId,
      subject: viewer.authUserId,
    })
    .mutation(
      api.contents.mutations.views.recordContentView,
      publishedViewArgs(deviceId, publicPath)
    );
}
