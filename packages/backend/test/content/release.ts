import { createHash } from "node:crypto";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import type { ContentDeliveryClass } from "@nakafa/aksara-contracts/delivery";
import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
  type AppLocaleCode,
  AppLocaleSchema,
  type ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  CONTENT_RELEASE_FORMAT,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import {
  ContentSnapshotKindSchema,
  type PublicationScope,
  PublicationScopeSchema,
} from "@nakafa/aksara-contracts/release/snapshot/scope";
import {
  type ContentSnapshotSet,
  ContentSnapshotSetSchema,
  inheritContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import { testMaterialPublicPath } from "@repo/backend/test/content/material";
import { Effect, Schema } from "effect";

type ArtifactLocaleCode = Schema.Codec.Encoded<typeof ArtifactLocaleSchema>;
/** Plain codec: writes the same bytes as JSON.stringify. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
export const TEST_DIGEST = Sha256HashSchema.make(`sha256:${"0".repeat(64)}`);
export const TEST_MANIFEST_HASH = Sha256HashSchema.make(
  `sha256:${"1".repeat(64)}`
);
export const TEST_ARTIFACT_HASH = Sha256HashSchema.make(
  `sha256:${"2".repeat(64)}`
);
export const TEST_RELEASE_ID = ReleaseIdSchema.make("release-test");
/** Creates the exact graph identity derived from one article source key. */
export function testArticleGraph(
  articleSlug: string,
  appLocale: AppLocaleCode = "en"
) {
  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["article", "politics"],
      learningObject: ["article", "politics", articleSlug],
      lens: ["article", "politics"],
      appLocale: AppLocaleSchema.make(appLocale),
    })
  );
}
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
  const base = [componentName];
  return encodeJson({
    base,
    domains: RENDERER_DOMAINS.map((name) => ({
      components: [],
      name,
    })),
    format: "nakafa-mdx-renderer",
    hash,
    publishedDomains: ["mathematics"],
  });
}
const ReleaseOptionsSchema = Schema.Struct({
  activeAppLocales: Schema.optional(Schema.Array(ActiveAppLocaleCodeSchema)),
  baseManifestHash: Schema.optional(Schema.NullOr(Schema.String)),
  baseReleaseId: Schema.optional(Schema.NullOr(Schema.String)),
  baseResultCount: Schema.optional(Schema.Finite),
  baseResultDigest: Schema.optional(Schema.String),
  deleteCount: Schema.optional(Schema.Finite),
  itemCount: Schema.optional(Schema.Finite),
  manifestHash: Schema.optional(Schema.String),
  originKind: Schema.optional(Schema.Literals(["git", "rollback"])),
  originReleaseId: Schema.optional(Schema.String),
  projectionCount: Schema.optional(Schema.Finite),
  releaseId: Schema.optional(Schema.String),
  rendererHash: Schema.optional(Schema.String),
  resultCount: Schema.optional(Schema.Finite),
  resultDigest: Schema.optional(Schema.String),
  rollbackDigest: Schema.optional(Schema.String),
  routeCount: Schema.optional(Schema.Finite),
  routeDigest: Schema.optional(Schema.String),
  scope: Schema.optional(PublicationScopeSchema),
  snapshots: Schema.optional(ContentSnapshotSetSchema),
  upsertCount: Schema.optional(Schema.Finite),
});
type ReleaseOptions = typeof ReleaseOptionsSchema.Type;
/** Creates canonical broad test scope plus every replaced snapshot family. */
export function testPublicationScope(options?: {
  readonly families?: PublicationScope["families"] | undefined;
  readonly snapshots?: ContentSnapshotSet | undefined;
}) {
  const snapshots = options?.snapshots ?? inheritContentSnapshots(null);
  return PublicationScopeSchema.make({
    families: options?.families ?? ContentFamilySchema.literals,
    snapshots: ContentSnapshotKindSchema.literals.filter(
      (family) => snapshots[family].mode !== "inherit"
    ),
  });
}
/** Creates one schema-valid signed release envelope for backend tests. */
export function testReleaseJson({
  itemCount = 1,
  upsertCount = itemCount,
  baseReleaseId = null,
  snapshots = inheritContentSnapshots(null),
  activeAppLocales = ACTIVE_APP_LOCALE_CODES,
  baseManifestHash,
  baseResultCount = 1,
  baseResultDigest = TEST_DIGEST,
  deleteCount = itemCount - upsertCount,
  manifestHash = TEST_MANIFEST_HASH,
  originKind,
  originReleaseId,
  projectionCount = upsertCount,
  releaseId = TEST_RELEASE_ID,
  rendererHash = TEST_DIGEST,
  resultCount = upsertCount,
  resultDigest = TEST_DIGEST,
  rollbackDigest = TEST_DIGEST,
  routeCount = upsertCount,
  routeDigest = TEST_DIGEST,
  scope = testPublicationScope({ snapshots }),
}: ReleaseOptions = {}) {
  const rollback = originKind ? originKind === "rollback" : !!originReleaseId;
  const origin = rollback
    ? { kind: "rollback", releaseId: originReleaseId ?? baseReleaseId }
    : { kind: "git", sha: "a".repeat(40) };
  return encodeJson({
    keyId: "test-key",
    manifest: {
      activeAppLocales,
      baseActiveAppLocales: baseReleaseId === null ? null : activeAppLocales,
      baseManifestHash:
        baseReleaseId === null
          ? null
          : (baseManifestHash ?? TEST_MANIFEST_HASH),
      baseReleaseId,
      baseResultCount: baseReleaseId === null ? 0 : baseResultCount,
      baseResultDigest:
        baseReleaseId === null ? EMPTY_RESULT_CATALOG_DIGEST : baseResultDigest,
      deleteCount,
      itemCount,
      itemsDigest: TEST_DIGEST,
      origin,
      projectionCount,
      projectionDigest: TEST_DIGEST,
      releaseId,
      rendererManifestHash: rendererHash,
      resultCount,
      resultDigest,
      rollbackCount: itemCount,
      rollbackDigest,
      routeCount,
      routeDigest,
      scope,
      snapshots,
      upsertCount,
      format: CONTENT_RELEASE_FORMAT,
    },
    manifestHash,
    signature: "A".repeat(86),
  });
}
/**
 * Projects one canonical fixture's signed bytes into its stored facts.
 *
 * Stored reachability facts are a required release field, so fixtures derive
 * them from the same signed bytes through the production projector.
 */
export function testStoredReachability(releaseJson: string) {
  return releaseReachability(
    Schema.decodeSync(Schema.fromJsonString(SignedContentReleaseSchema))(
      releaseJson
    )
  );
}

/** Creates one canonical snapshot for a previously absent head. */
export function testRollbackJson(options?: {
  readonly artifactLocale?: ArtifactLocaleCode | undefined;
  readonly contentKey?: string | undefined;
  readonly family?: ContentFamily | undefined;
  readonly index?: number | undefined;
  readonly releaseId?: string | undefined;
}) {
  const index = options?.index ?? 0;
  return encodeJson({
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
    snapshot: {
      artifactLocale: options?.artifactLocale ?? "en",
      contentKey: options?.contentKey ?? `test:head-${index}`,
      family: options?.family ?? "material",
      state: "absent",
    },
  });
}
/** Creates one canonical technical upsert item. */
export function testUpsertJson(options?: {
  readonly artifactHash?: string | undefined;
  readonly artifactLocale?: ArtifactLocaleCode | undefined;
  readonly contentKey?: string | undefined;
  readonly delivery?: ContentDeliveryClass | undefined;
  readonly family?: ContentFamily | undefined;
  readonly index?: number | undefined;
  readonly releaseId?: string | undefined;
  readonly rendererDomain?: RendererDomain | undefined;
  readonly sourcePath?: string | undefined;
}) {
  const index = options?.index ?? 0;
  const artifactLocale = options?.artifactLocale ?? "en";
  return encodeJson({
    change: {
      artifactHash: options?.artifactHash ?? TEST_ARTIFACT_HASH,
      artifactLocale,
      contentKey: options?.contentKey ?? `test:head-${index}`,
      delivery: options?.delivery ?? "public",
      family: options?.family ?? "material",
      operation: "upsert",
      rendererDomain: options?.rendererDomain ?? "mathematics",
      sourcePath:
        options?.sourcePath ??
        `packages/corpus/test/head-${index}/${artifactLocale}.mdx`,
    },
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}
/** Creates one canonical technical route change. */
export function testRouteJson(options?: {
  readonly appLocale?: ActiveAppLocaleCode | undefined;
  readonly contentKey?: string | undefined;
  readonly index?: number | undefined;
  readonly operation?: "bind" | "delete" | undefined;
  readonly publicPath?: string | undefined;
  readonly releaseId?: string | undefined;
}) {
  const index = options?.index ?? 0;
  const appLocale = options?.appLocale ?? "en";
  const change = {
    ...(options?.operation === "delete"
      ? {}
      : { contentKey: options?.contentKey ?? `test:head-${index}` }),
    appLocale,
    operation: options?.operation ?? "bind",
    publicPath: options?.publicPath ?? testMaterialPublicPath(index, appLocale),
  };
  return encodeJson({
    change,
    index,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}
/** Creates one canonical technical delete item. */
export function testDeleteJson(options?: {
  readonly artifactLocale?: ArtifactLocaleCode | undefined;
  readonly contentKey?: string | undefined;
  readonly family?: ContentFamily | undefined;
  readonly index?: number | undefined;
  readonly releaseId?: string | undefined;
}) {
  return encodeJson({
    change: {
      artifactLocale: options?.artifactLocale ?? "en",
      contentKey: options?.contentKey ?? "test:deleted",
      family: options?.family ?? "material",
      operation: "delete",
    },
    index: options?.index ?? 0,
    releaseId: options?.releaseId ?? TEST_RELEASE_ID,
  });
}
