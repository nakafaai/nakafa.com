import {
  CompiledContentPayloadSchema,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  Ed25519SignatureSchema,
  GitCommitShaSchema,
  type Sha256Hash,
  Sha256HashSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  LOCAL_PREVIEW_FORMAT,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import {
  MaterialLessonRouteSchema,
  MaterialMetadataSchema,
  makeMaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Redacted, Schema } from "effect";
import { NextRequest } from "next/server";
import type { PreviewConfig } from "@/lib/content/preview/config";
import type { MaterialPreviewInput } from "@/lib/content/preview/material";

/** Test-only renderer hash distinct from the active Nakafa manifest. */
export const previewManifestHash = Sha256HashSchema.make(
  `sha256:${"a".repeat(64)}`
);
/** Test-only identity for the generic signed-wire artifact fixture. */
export const previewArtifactHash = Sha256HashSchema.make(
  `sha256:${"b".repeat(64)}`
);
const sourceHash = Sha256HashSchema.make(`sha256:${"c".repeat(64)}`);
const configHash = Sha256HashSchema.make(`sha256:${"d".repeat(64)}`);

/** Ephemeral key identity used only by local preview tests. */
export const previewKeyId = SigningKeyIdSchema.make("local-preview");

/** Exact English route owned by the real Function Concept source. */
export const previewRoute = Schema.decodeUnknownSync(MaterialLessonRouteSchema)(
  {
    contentKey: ContentKeySchema.make(
      "material/lesson/mathematics/function-composition-inverse-function/function-concept"
    ),
    locale: "en",
    materialKey: "lesson.mathematics.function-composition-inverse-function",
    order: 5,
    publicPath:
      "subjects/mathematics/function-composition-inverse-function/function-concept",
    sectionKey: "function-concept",
  }
);

/** Exact metadata authored by the real English Function Concept lesson. */
export const previewMetadata = MaterialMetadataSchema.make({
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "2025-04-27",
  description:
    "Understand functions as magic machines with interactive examples. Learn f(x) notation, input-output relationships, and the one-to-one rule.",
  subject: "Function Composition and Inverse Function",
  title: "Function Concept",
});

/** Exact material projection derived from the selected real document. */
export const previewProjection = makeMaterialLessonProjection(
  previewRoute,
  previewMetadata
);

/** Exact Nakafa public route adapted from the real preview projection. */
export const previewPublicRoute = Schema.decodeUnknownSync(
  PublicContentRouteSchema
)({
  description: previewProjection.metadata.description,
  kind: previewProjection.kind,
  locale: previewProjection.locale,
  materialKey: previewProjection.materialKey,
  order: previewProjection.order,
  parentPath: previewProjection.parentPath,
  publicPath: previewProjection.publicPath,
  sectionKey: previewProjection.sectionKey,
  sitemap: previewProjection.sitemap,
  sourcePath: previewProjection.contentKey,
  title: previewProjection.metadata.title,
});

/** Exact filtered-history source path selected by the Aksara CLI. */
export const previewSourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx"
);

/** Exact localized pathname selected by the next-intl preview rewrite. */
export const previewPathname =
  "/en/materials/mathematics/function-composition-inverse-function/function-concept";

/** Route evidence expected by the internal preview matcher. */
export const previewRouteEvidence = {
  localeHint: "en",
  pathname: previewPathname,
};

/** Complete loopback configuration with redacted test-only credentials. */
export const previewConfig: PreviewConfig = {
  eventsPath: "/v1/events",
  keyId: previewKeyId,
  manifestPath: "/v1/manifest",
  origin: new URL("http://127.0.0.1:4000/"),
  publicKey: "test-public-key",
  token: Redacted.make("test-token"),
};

/** Builds the real Function Concept route input for one physical registry. */
export function makePreviewInput(
  components: MDXComponents
): MaterialPreviewInput {
  return {
    components,
    params: {
      lesson: ["function-concept"],
      locale: previewRoute.locale,
      topic: "function-composition-inverse-function",
    },
    target: "mathematics",
  };
}

/** Empty MDX source used only to exercise preview protocol wiring. */
export const previewWireMdx = "";
const previewWireCode = "return { default: () => null }";

/** Signed-wire sample that deliberately does not claim educational fidelity. */
export const previewWireArtifact = SignedContentArtifactSchema.make({
  artifactHash: previewArtifactHash,
  keyId: previewKeyId,
  payload: CompiledContentPayloadSchema.make({
    byteLength: new TextEncoder().encode(previewWireCode).byteLength,
    compiledCode: previewWireCode,
    compilerConfigHash: configHash,
    compilerVersion: "0.1.0",
    contentKey: previewRoute.contentKey,
    format: "mdx-function-body-v1",
    locale: previewRoute.locale,
    mdxCompilerVersion: "3.1.1",
    plainText: "",
    rawMdx: previewWireMdx,
    rendererDomain: "mathematics",
    requiredComponents: [],
    sourceHash,
  }),
  signature: Ed25519SignatureSchema.make(`${"A".repeat(85)}A`),
});

/** Exact Git evidence shape served by the test-only provider. */
export const previewRepositories = {
  aksara: { dirty: true, sha: GitCommitShaSchema.make("a".repeat(40)) },
  nakafa: { dirty: true, sha: GitCommitShaSchema.make("b".repeat(40)) },
};

/** Creates the next-intl rewrite request for the real preview document. */
export function makePreviewRequest() {
  return new NextRequest(`http://localhost:3000${previewPathname}`, {
    headers: { "x-next-intl-locale": "en" },
  });
}

/** Creates one ready manifest for a caller-provided renderer contract. */
export function makeReadyManifest(rendererManifestHash: Sha256Hash) {
  return Schema.decodeUnknownSync(LocalPreviewManifestSchema)(
    {
      artifactHash: previewArtifactHash,
      artifactPath: `/v1/artifacts/${encodeURIComponent(previewArtifactHash)}`,
      document: {
        delivery: "public",
        rendererDomain: "mathematics",
        route: previewRoute,
        sourcePath: previewSourcePath,
      },
      format: LOCAL_PREVIEW_FORMAT,
      projection: previewProjection,
      rendererManifestHash,
      repositories: previewRepositories,
      revision: 1,
      status: "ready",
    },
    { onExcessProperty: "error" }
  );
}

/** Creates the exact pending state without ready-only artifact fields. */
export function makePendingManifest() {
  return Schema.decodeUnknownSync(LocalPreviewManifestSchema)(
    {
      document: makeReadyManifest(previewManifestHash).document,
      format: LOCAL_PREVIEW_FORMAT,
      repositories: previewRepositories,
      revision: 1,
      status: "pending",
    },
    { onExcessProperty: "error" }
  );
}

/** Creates one sanitized compiler failure without an older artifact. */
export function makeFailedManifest() {
  return Schema.decodeUnknownSync(LocalPreviewManifestSchema)(
    {
      document: makeReadyManifest(previewManifestHash).document,
      failure: { code: "MDX_PARSE", message: "Compilation failed." },
      format: LOCAL_PREVIEW_FORMAT,
      repositories: previewRepositories,
      revision: 1,
      status: "failed",
    },
    { onExcessProperty: "error" }
  );
}
