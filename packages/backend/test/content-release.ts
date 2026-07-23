import { createHash } from "node:crypto";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

export const TEST_DIGEST = Sha256HashSchema.make(`sha256:${"0".repeat(64)}`);
export const TEST_MANIFEST_HASH = Sha256HashSchema.make(
  `sha256:${"1".repeat(64)}`
);
export const TEST_ARTIFACT_HASH = Sha256HashSchema.make(
  `sha256:${"2".repeat(64)}`
);
export const TEST_RELEASE_ID = ReleaseIdSchema.make("release-test");

/** Hashes one canonical technical wire value with the production algorithm. */
export function testTextHash(value: string) {
  return Sha256HashSchema.make(
    `sha256:${createHash("sha256").update(value).digest("hex")}`
  );
}

/** Creates a complete technical renderer snapshot with no lesson content. */
export function testRendererJson(
  hash: string = TEST_DIGEST,
  componentName = "p"
) {
  const base = [{ name: componentName, version: 1 }];
  return JSON.stringify({
    base: { authoringComponents: base, supportedComponents: base },
    domains: RENDERER_DOMAINS.map((name) => ({
      authoringComponents: [],
      name,
      supportedComponents: [],
    })),
    format: "nakafa-mdx-renderer-v1",
    hash,
    rendererContractVersion: "1.0.0",
  });
}

interface ReleaseOptions {
  readonly baseManifestHash?: null | string;
  readonly baseReleaseId?: null | string;
  readonly baseResultCount?: number;
  readonly baseResultDigest?: string;
  readonly deleteCount?: number;
  readonly itemCount?: number;
  readonly manifestHash?: string;
  readonly originReleaseId?: string;
  readonly projectionCount?: number;
  readonly releaseId?: string;
  readonly rendererHash?: string;
  readonly resultCount?: number;
  readonly resultDigest?: string;
  readonly rollbackDigest?: string;
  readonly routeCount?: number;
  readonly routeDigest?: string;
  readonly upsertCount?: number;
}

/** Creates one schema-valid signed release envelope for backend tests. */
export function testReleaseJson(options?: ReleaseOptions) {
  const itemCount = options?.itemCount ?? 1;
  const upsertCount = options?.upsertCount ?? itemCount;
  const baseReleaseId = options?.baseReleaseId ?? null;
  const origin = options?.originReleaseId
    ? { kind: "rollback", releaseId: options.originReleaseId }
    : { kind: "git", sha: "a".repeat(40) };
  return JSON.stringify({
    keyId: "test-key",
    manifest: {
      baseManifestHash:
        baseReleaseId === null
          ? null
          : (options?.baseManifestHash ?? TEST_MANIFEST_HASH),
      baseReleaseId,
      baseResultCount:
        baseReleaseId === null ? 0 : (options?.baseResultCount ?? 1),
      baseResultDigest:
        baseReleaseId === null
          ? EMPTY_RESULT_CATALOG_DIGEST
          : (options?.baseResultDigest ?? TEST_DIGEST),
      deleteCount: options?.deleteCount ?? itemCount - upsertCount,
      itemCount,
      itemsDigest: TEST_DIGEST,
      origin,
      projectionCount: options?.projectionCount ?? upsertCount,
      projectionDigest: TEST_DIGEST,
      releaseId: options?.releaseId ?? TEST_RELEASE_ID,
      rendererContractVersion: "1.0.0",
      rendererManifestHash: options?.rendererHash ?? TEST_DIGEST,
      resultCount: options?.resultCount ?? upsertCount,
      resultDigest: options?.resultDigest ?? TEST_DIGEST,
      rollbackCount: itemCount,
      rollbackDigest: options?.rollbackDigest ?? TEST_DIGEST,
      routeCount: options?.routeCount ?? upsertCount,
      routeDigest: options?.routeDigest ?? TEST_DIGEST,
      upsertCount,
    },
    manifestHash: options?.manifestHash ?? TEST_MANIFEST_HASH,
    signature: "A".repeat(86),
  });
}

/** Creates one canonical snapshot for a previously absent head. */
export function testRollbackJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: "en" | "id";
  readonly releaseId?: string;
}) {
  const index = options?.index ?? 0;
  return JSON.stringify({
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
    snapshot: {
      contentKey: options?.contentKey ?? `test:head-${index}`,
      locale: options?.locale ?? "en",
      state: "absent",
    },
  });
}

/** Creates one canonical technical upsert item. */
export function testUpsertJson(options?: {
  readonly artifactHash?: string;
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: "en" | "id";
  readonly releaseId?: string;
  readonly sourcePath?: string;
}) {
  const index = options?.index ?? 0;
  const locale = options?.locale ?? "en";
  return JSON.stringify({
    change: {
      artifactHash: options?.artifactHash ?? TEST_ARTIFACT_HASH,
      contentKey: options?.contentKey ?? `test:head-${index}`,
      delivery: "public",
      locale,
      operation: "upsert",
      rendererDomain: "mathematics",
      sourcePath:
        options?.sourcePath ??
        `packages/corpus/test/head-${index}/${locale}.mdx`,
    },
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}

/** Creates one canonical technical route change. */
export function testRouteJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: "en" | "id";
  readonly operation?: "bind" | "delete";
  readonly publicPath?: string;
  readonly releaseId?: string;
}) {
  const index = options?.index ?? 0;
  const change = {
    ...(options?.operation === "delete"
      ? {}
      : { contentKey: options?.contentKey ?? `test:head-${index}` }),
    locale: options?.locale ?? "en",
    operation: options?.operation ?? "bind",
    publicPath: options?.publicPath ?? `test/head-${index}`,
  };
  return JSON.stringify({
    change,
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}

/** Creates one canonical technical delete item. */
export function testDeleteJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: "en" | "id";
  readonly releaseId?: string;
}) {
  return JSON.stringify({
    change: {
      contentKey: options?.contentKey ?? "test:deleted",
      locale: options?.locale ?? "en",
      operation: "delete",
    },
    index: options?.index ?? 0,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}

/** Creates one canonical technical material projection. */
export function testProjectionJson(options?: {
  readonly contentKey?: string;
  readonly index?: number;
  readonly locale?: "en" | "id";
  readonly publicPath?: string;
  readonly title?: string;
}) {
  const index = options?.index ?? 0;
  return JSON.stringify({
    contentKey: options?.contentKey ?? `test:head-${index}`,
    kind: "subject-lesson",
    locale: options?.locale ?? "en",
    materialKey: `test.${index}`,
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-22",
      title: options?.title ?? `Technical Head ${index}`,
    },
    order: index + 1,
    parentPath: "test",
    publicPath: options?.publicPath ?? `test/head-${index}`,
    sectionKey: `head-${index}`,
    sitemap: true,
  });
}

/** Inserts one pending release with exact sequence-slot ownership. */
export async function insertTestRelease(
  ctx: MutationCtx,
  options?: {
    readonly checkedIndex?: number;
    readonly checkedItems?: number;
    readonly deleteCount?: number;
    readonly itemCount?: number;
    readonly projectionCount?: number;
    readonly releaseId?: string;
    readonly role?: "candidate" | "recovery";
    readonly routeCount?: number;
    readonly sequence?: number;
    readonly stagedArtifacts?: number;
    readonly stagedDeletes?: number;
    readonly stagedItems?: number;
    readonly stagedProjections?: number;
    readonly stagedRoutes?: number;
    readonly stagedUpserts?: number;
    readonly status?: "staging" | "verified" | "verifying";
    readonly upsertCount?: number;
  }
) {
  const now = Date.UTC(2026, 6, 22, 12);
  const releaseId = options?.releaseId ?? TEST_RELEASE_ID;
  const role = options?.role ?? "candidate";
  const sequence = options?.sequence ?? 1;
  const itemCount = options?.itemCount ?? 1;
  const upsertCount = options?.upsertCount ?? itemCount;
  await ctx.db.insert("contentReleases", {
    checkedIndex: options?.checkedIndex ?? -1,
    checkedItems: options?.checkedItems ?? 0,
    createdAt: now,
    releaseId,
    releaseJson: testReleaseJson({
      deleteCount: options?.deleteCount ?? itemCount - upsertCount,
      itemCount,
      projectionCount: options?.projectionCount ?? upsertCount,
      releaseId,
      routeCount: options?.routeCount ?? upsertCount,
      upsertCount,
    }),
    rendererJson: testRendererJson(),
    role,
    sequence,
    stagedArtifacts: options?.stagedArtifacts ?? 0,
    stagedDeletes: options?.stagedDeletes ?? 0,
    stagedItems: options?.stagedItems ?? 0,
    stagedProjections: options?.stagedProjections ?? 0,
    stagedRoutes: options?.stagedRoutes ?? 0,
    stagedUpserts: options?.stagedUpserts ?? 0,
    status: options?.status ?? "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    ...(role === "candidate"
      ? {
          candidateManifestHash: TEST_MANIFEST_HASH,
          candidateReleaseId: releaseId,
          candidateSequence: sequence,
        }
      : {
          recoveryManifestHash: TEST_MANIFEST_HASH,
          recoveryReleaseId: releaseId,
          recoverySequence: sequence,
        }),
    key: "primary",
    nextSequence: sequence + 1,
    updatedAt: now,
  });
}
