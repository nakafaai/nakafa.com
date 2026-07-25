import { MaterialHeadSchema } from "@nakafa/aksara-contracts/release/head";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testProjectionJson,
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content-release";
import { Schema } from "effect";

interface HeadOptions {
  readonly contentKey: string;
  readonly operation?: "delete" | "upsert";
  readonly releaseId?: string;
  readonly sequence?: number;
}

/** Inserts one permanent key plus its immutable head and route versions. */
export async function insertTestHead(ctx: MutationCtx, options: HeadOptions) {
  const sequence = options.sequence ?? 1;
  const releaseId = options.releaseId ?? TEST_RELEASE_ID;
  const operation = options.operation ?? "upsert";
  const publicPath = `test/${options.contentKey.slice(5)}`;
  const projectionJson = testProjectionJson({
    contentKey: options.contentKey,
    publicPath,
  });
  await ctx.db.insert("contentKeys", {
    contentKey: options.contentKey,
    createdSequence: sequence,
    family: "material",
    locale: "en",
  });
  await ctx.db.insert("contentHeads", {
    ...(operation === "upsert"
      ? {
          artifactHash: `sha256:${sequence.toString(16).padStart(64, "0")}`,
          compilerConfigHash: TEST_DIGEST,
          delivery: "public",
          projectionHash: testTextHash(projectionJson),
          projectionJson,
          rendererDomain: "mathematics",
          sourceHash: TEST_DIGEST,
          sourcePath: `packages/corpus/test/${options.contentKey.slice(5)}/en.mdx`,
        }
      : {}),
    contentKey: options.contentKey,
    family: "material",
    index: 0,
    locale: "en",
    operation,
    releaseId,
    sequence,
  });
  if (operation === "delete") {
    return;
  }
  await ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey: options.contentKey,
    index: 0,
    locale: "en",
    operation: "bind",
    publicPath,
    releaseId,
    routeJson: testRouteJson({
      contentKey: options.contentKey,
      publicPath,
      releaseId,
    }),
    sequence,
  });
}

/** Builds one maximum-width contract-valid material head. */
export function maximumTestHead(index: number) {
  const suffix = index.toString().padStart(4, "0");
  const sourcePrefix = "packages/corpus/a/";
  return Schema.decodeUnknownSync(MaterialHeadSchema)({
    artifactHash: `sha256:${"a".repeat(64)}`,
    compilerConfigHash: `sha256:${"b".repeat(64)}`,
    contentKey: "a".repeat(512 - suffix.length) + suffix,
    delivery: "authenticated",
    family: "material",
    locale: "en",
    projectionHash: `sha256:${"c".repeat(64)}`,
    publicPath: "a".repeat(2048 - suffix.length) + suffix,
    rendererDomain: "snbt-general",
    sourceHash: `sha256:${"d".repeat(64)}`,
    sourcePath:
      sourcePrefix +
      "a".repeat(2048 - sourcePrefix.length - suffix.length) +
      suffix,
  });
}
