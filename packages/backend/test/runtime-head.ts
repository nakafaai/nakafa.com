import type { ContentDeliveryClass } from "@nakafa/aksara-contracts/delivery";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import {
  ContentProjectionSchema,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { writeSearchEntry } from "@repo/backend/convex/contentRelease/search/write";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import { testSignedArtifact } from "@repo/backend/test/content-proof";
import {
  TEST_DIGEST,
  testProjectionJson,
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content-release";
import {
  TEST_RUNTIME_NOW,
  TEST_RUNTIME_PATH,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import { Schema } from "effect";

/** Optional identities used to shape immutable runtime head fixtures. */
export interface RuntimeHeadOptions {
  readonly artifactHash?: string;
  readonly bindingReleaseId?: string;
  readonly bindingSequence?: number;
  readonly compiledCode?: string;
  readonly headReleaseId?: string;
  readonly headSequence?: number;
  readonly plainText?: string;
  readonly projectionJson?: string;
  readonly publicPath?: string;
  readonly rendererDomain?: RendererDomain;
  readonly sourcePath?: string;
}

/** Inserts one complete immutable artifact used by a selected route binding. */
export async function insertRuntimeArtifact(
  ctx: MutationCtx,
  artifactHash: string,
  contentKey: string,
  options?: Pick<
    RuntimeHeadOptions,
    "compiledCode" | "plainText" | "rendererDomain"
  >
) {
  await ctx.db.insert("contentArtifacts", {
    artifactHash,
    artifactJson: testArtifactJson({
      artifactHash,
      compiledCode: options?.compiledCode,
      contentKey,
      plainText: options?.plainText,
      rendererDomain: options?.rendererDomain,
    }),
    createdAt: TEST_RUNTIME_NOW,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
}

/** Inserts one immutable content version and its signed artifact. */
export async function insertRuntimeVersion(
  ctx: MutationCtx,
  delivery: ContentDeliveryClass,
  contentKey: string,
  options?: RuntimeHeadOptions
) {
  const publicPath = options?.publicPath ?? TEST_RUNTIME_PATH;
  const artifactHash = options?.artifactHash ?? `sha256:${"3".repeat(64)}`;
  const projectionJson =
    options?.projectionJson ?? testProjectionJson({ contentKey, publicPath });
  const projection = Schema.decodeUnknownSync(ContentProjectionSchema)(
    JSON.parse(projectionJson)
  );
  const headSequence = options?.headSequence ?? TEST_RUNTIME_RELEASE.sequence;
  const headReleaseId =
    options?.headReleaseId ?? TEST_RUNTIME_RELEASE.releaseId;
  const rendererDomain = options?.rendererDomain ?? "mathematics";
  const sourcePath =
    options?.sourcePath ??
    (contentKey.startsWith("material/")
      ? `packages/corpus/${contentKey}/en.mdx`
      : `packages/corpus/material/lesson/test/${contentKey.slice(5)}/en.mdx`);
  await ctx.db.insert("contentHeads", {
    artifactHash,
    compilerConfigHash: TEST_DIGEST,
    contentKey,
    delivery,
    family: familyForProjection(projection),
    index: 0,
    locale: "en",
    operation: "upsert",
    projectionHash: testTextHash(projectionJson),
    projectionJson,
    releaseId: headReleaseId,
    rendererDomain,
    sequence: headSequence,
    sourceHash: TEST_DIGEST,
    sourcePath,
  });
  await insertRuntimeArtifact(ctx, artifactHash, contentKey, options);
}

/** Inserts one permanent content identity used by projection pagination. */
export async function insertRuntimeKey(
  ctx: MutationCtx,
  contentKey: string,
  options?: Pick<RuntimeHeadOptions, "headSequence" | "projectionJson">
) {
  const projectionJson =
    options?.projectionJson ?? testProjectionJson({ contentKey });
  const projection = Schema.decodeUnknownSync(ContentProjectionSchema)(
    JSON.parse(projectionJson)
  );
  await ctx.db.insert("contentKeys", {
    contentKey,
    createdSequence: options?.headSequence ?? TEST_RUNTIME_RELEASE.sequence,
    family: familyForProjection(projection),
    locale: projection.locale,
  });
}

/** Writes one test search version through the production indexing program. */
export async function insertRuntimeIndex(
  ctx: MutationCtx,
  contentKey: string,
  options?: Pick<RuntimeHeadOptions, "headSequence" | "plainText">
) {
  const sequence = options?.headSequence ?? TEST_RUNTIME_RELEASE.sequence;
  const head = await ctx.db
    .query("contentHeads")
    .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
      index
        .eq("contentKey", contentKey)
        .eq("locale", "en")
        .eq("sequence", sequence)
    )
    .unique();
  if (!(head?.projectionJson && head.operation === "upsert")) {
    throw new Error("Expected one complete searchable runtime head.");
  }
  const projection = Schema.decodeUnknownSync(ContentProjectionSchema)(
    JSON.parse(head.projectionJson)
  );
  await runConvexProgram(
    writeSearchEntry(
      ctx,
      head,
      projection,
      options?.plainText ?? "Technical fixture"
    )
  );
}

/** Inserts one immutable route version plus its permanent path identity. */
export async function insertRuntimeBinding(
  ctx: MutationCtx,
  contentKey: null | string,
  options?: Pick<
    RuntimeHeadOptions,
    "bindingReleaseId" | "bindingSequence" | "publicPath"
  >
) {
  const publicPath = options?.publicPath ?? TEST_RUNTIME_PATH;
  const bindingSequence =
    options?.bindingSequence ?? TEST_RUNTIME_RELEASE.sequence;
  const bindingReleaseId =
    options?.bindingReleaseId ?? TEST_RUNTIME_RELEASE.releaseId;
  const operation = contentKey === null ? "delete" : "bind";
  await ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    ...(contentKey === null ? {} : { contentKey }),
    index: 0,
    locale: "en",
    operation,
    publicPath,
    releaseId: bindingReleaseId,
    routeJson: testRouteJson({
      ...(contentKey === null ? {} : { contentKey }),
      operation,
      publicPath,
      releaseId: bindingReleaseId,
    }),
    sequence: bindingSequence,
  });
  const path = await ctx.db
    .query("contentPaths")
    .withIndex("by_locale_and_publicPath", (index) =>
      index.eq("locale", "en").eq("publicPath", publicPath)
    )
    .unique();
  if (!path) {
    await ctx.db.insert("contentPaths", {
      createdSequence: bindingSequence,
      locale: "en",
      publicPath,
    });
  }
}

/** Inserts one immutable head, route binding, path, and signed artifact. */
export async function insertRuntimeHead(
  ctx: MutationCtx,
  delivery: ContentDeliveryClass,
  contentKey: string,
  options?: RuntimeHeadOptions
) {
  await insertRuntimeVersion(ctx, delivery, contentKey, options);
  await insertRuntimeBinding(ctx, contentKey, options);
}

/** Inserts one route whose release and artifact pass real signature checks. */
export async function insertSignedHead(
  ctx: MutationCtx,
  delivery: ContentDeliveryClass,
  contentKey: string,
  options?: Pick<
    RuntimeHeadOptions,
    | "compiledCode"
    | "projectionJson"
    | "publicPath"
    | "rendererDomain"
    | "sourcePath"
  >
) {
  const projectionJson =
    options?.projectionJson ??
    testProjectionJson({ contentKey, publicPath: TEST_RUNTIME_PATH });
  const projection = Schema.decodeUnknownSync(ContentProjectionSchema)(
    JSON.parse(projectionJson)
  );
  const rendererDomain = options?.rendererDomain ?? "mathematics";
  const artifact = testSignedArtifact(rendererDomain, {
    compiledCode: options?.compiledCode,
    contentKey,
  });
  await insertRuntimeHead(ctx, delivery, contentKey, {
    artifactHash: artifact.artifactHash,
    compiledCode: options?.compiledCode,
    projectionJson,
    publicPath: options?.publicPath,
    rendererDomain,
    sourcePath: options?.sourcePath,
  });
  const [head, storedArtifact] = await Promise.all([
    ctx.db.query("contentHeads").unique(),
    ctx.db.query("contentArtifacts").unique(),
  ]);
  if (!(head && storedArtifact)) {
    throw new Error("Expected one complete runtime head.");
  }
  await Promise.all([
    ctx.db.patch("contentHeads", head._id, {
      projectionHash: hashContentProjection(projection),
      sourceHash: artifact.payload.sourceHash,
    }),
    ctx.db.patch("contentArtifacts", storedArtifact._id, {
      artifactJson: JSON.stringify(artifact),
    }),
  ]);
}
