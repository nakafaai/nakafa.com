import {
  CompiledContentPayloadSchema,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import { makeLearningGraphIdentity } from "@nakafa/aksara-contracts/graph/identity";
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
  type AppLocaleCode,
  AppLocaleSchema,
  ArtifactLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { MaterialPreviewDocumentSchema } from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  PreviewFailedSchema,
  PreviewPendingSchema,
  PreviewReadySchema,
} from "@nakafa/aksara-contracts/preview/spec";
import {
  MaterialLessonRouteSchema,
  MaterialMetadataSchema,
  makeMaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Redacted, Schema } from "effect";
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

/** Derives the exact graph identity for one real material lesson fixture. */
export function makeMaterialGraph(
  domain: string,
  topic: string,
  section: string,
  appLocale: AppLocaleCode
) {
  return Effect.runSync(
    makeLearningGraphIdentity({
      concept: ["material", "lesson", domain, topic],
      learningObject: ["material-section", domain, topic, section],
      lens: ["material", "lesson", domain],
      appLocale: AppLocaleSchema.make(appLocale),
    })
  );
}

/** Exact English route owned by the real Function Concept source. */
export const previewRoute = Schema.decodeSync(MaterialLessonRouteSchema)({
  contentKey: ContentKeySchema.make(
    "material/lesson/mathematics/function-composition-inverse-function/function-concept"
  ),
  graph: makeMaterialGraph(
    "mathematics",
    "function-composition-inverse-function",
    "function-concept",
    "en"
  ),
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  materialKey: "lesson.mathematics.function-composition-inverse-function",
  order: 5,
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/function-concept",
  sectionKey: "function-concept",
  topicTitle: "Function Composition and Inverse Function",
});

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

/** Exact English route owned by the next real Function Concept sibling. */
export const previewNextRoute = Schema.decodeSync(MaterialLessonRouteSchema)({
  contentKey: ContentKeySchema.make(
    "material/lesson/mathematics/function-composition-inverse-function/injective-surjective-bijective-function"
  ),
  graph: makeMaterialGraph(
    "mathematics",
    "function-composition-inverse-function",
    "injective-surjective-bijective-function",
    "en"
  ),
  appLocale: AppLocaleSchema.make("en"),
  artifactLocale: ArtifactLocaleSchema.make("en"),
  materialKey: previewRoute.materialKey,
  order: 6,
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/injective-surjective-bijective-function",
  sectionKey: "injective-surjective-bijective-function",
  topicTitle: previewRoute.topicTitle,
});

/** Exact metadata authored by the next real Function Concept sibling. */
export const previewNextMetadata = MaterialMetadataSchema.make({
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "2025-04-27",
  description:
    "Learn one-to-one, onto, and bijective function types with clear examples. Understand mapping properties and inverse function requirements.",
  subject: "Function Composition and Inverse Function",
  title: "Injective, Surjective, and Bijective Functions",
});

/** Exact projection for the next real Function Concept sibling. */
export const previewNextProjection = makeMaterialLessonProjection(
  previewNextRoute,
  previewNextMetadata
);

/** Exact Indonesian route owned by the real Function Concept source. */
export const previewIdRoute = Schema.decodeSync(MaterialLessonRouteSchema)({
  contentKey: previewRoute.contentKey,
  graph: makeMaterialGraph(
    "mathematics",
    "function-composition-inverse-function",
    "function-concept",
    "id"
  ),
  appLocale: AppLocaleSchema.make("id"),
  artifactLocale: ArtifactLocaleSchema.make("id"),
  materialKey: previewRoute.materialKey,
  order: previewRoute.order,
  publicPath:
    "materi/matematika/fungsi-komposisi-dan-fungsi-invers/konsep-fungsi",
  sectionKey: previewRoute.sectionKey,
  topicTitle: "Fungsi Komposisi dan Fungsi Invers",
});

/** Exact Indonesian metadata authored by the real Function Concept lesson. */
export const previewIdMetadata = MaterialMetadataSchema.make({
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "2025-04-27",
  description:
    "Pahami fungsi sebagai mesin ajaib dengan contoh interaktif. Pelajari notasi f(x), hubungan input-output, dan aturan tepat satu.",
  subject: "Fungsi Komposisi dan Fungsi Invers",
  title: "Konsep Fungsi",
});

/** Exact Indonesian projection derived from the selected real document. */
export const previewIdProjection = makeMaterialLessonProjection(
  previewIdRoute,
  previewIdMetadata
);

/** Exact German route owned by the real Function Concept source. */
export const previewDeRoute = Schema.decodeSync(MaterialLessonRouteSchema)({
  contentKey: previewRoute.contentKey,
  graph: makeMaterialGraph(
    "mathematics",
    "function-composition-inverse-function",
    "function-concept",
    "de"
  ),
  appLocale: AppLocaleSchema.make("de"),
  artifactLocale: ArtifactLocaleSchema.make("de"),
  materialKey: previewRoute.materialKey,
  order: previewRoute.order,
  publicPath:
    "faecher/mathematik/funktionskomposition-und-umkehrfunktion/funktionsbegriff",
  sectionKey: previewRoute.sectionKey,
  topicTitle: "Funktionskomposition und Umkehrfunktion",
});

/** Exact German metadata authored by the real Function Concept lesson. */
export const previewDeMetadata = MaterialMetadataSchema.make({
  authors: [{ name: "Nabil Akbarazzima Fatih" }],
  date: "2025-04-27",
  description:
    "Verstehe Funktionen als Regeln, die jeder zulässigen Eingabe genau eine Ausgabe zuordnen, und lies anschließend Notation, Tabellen und geordnete Paare.",
  subject: "Funktionszusammensetzung und Umkehrfunktion",
  title: "Funktionsbegriff",
});

/** Exact German projection derived from the selected real document. */
export const previewDeProjection = makeMaterialLessonProjection(
  previewDeRoute,
  previewDeMetadata
);

/** Exact filtered-history source path selected by the Aksara CLI. */
export const previewSourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/material/lesson/mathematics/function-composition-inverse-function/function-concept/en.mdx"
);

/** Exact material document selected by every local preview test fixture. */
export const previewDocument = Schema.decodeSync(MaterialPreviewDocumentSchema)(
  {
    delivery: "public",
    family: "material",
    rendererDomain: "mathematics",
    route: previewRoute,
    sourcePath: previewSourcePath,
  }
);

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
export function makePreviewInput(): MaterialPreviewInput {
  return {
    params: {
      lesson: ["function-concept"],
      locale: previewRoute.appLocale,
      subject: "mathematics",
      topic: "function-composition-inverse-function",
    },
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
    artifactLocale: previewRoute.artifactLocale,
    format: "mdx-function-body",
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

/** Creates one ready manifest for a caller-provided renderer contract. */
export function makeReadyManifest(rendererManifestHash: Sha256Hash) {
  const manifest = Schema.decodeSync(PreviewReadySchema)(
    {
      artifacts: [
        {
          artifactHash: previewArtifactHash,
          artifactPath: `/v1/artifacts/${encodeURIComponent(previewArtifactHash)}`,
          projection: previewProjection,
        },
      ],
      document: previewDocument,
      format: LOCAL_PREVIEW_FORMAT,
      rendererManifestHash,
      repositories: previewRepositories,
      revision: 1,
      status: "ready",
    },
    { onExcessProperty: "error" }
  );
  return { ...manifest, document: previewDocument };
}

/** Creates the exact pending state without ready-only artifact fields. */
export function makePendingManifest() {
  const manifest = Schema.decodeSync(PreviewPendingSchema)(
    {
      document: makeReadyManifest(previewManifestHash).document,
      format: LOCAL_PREVIEW_FORMAT,
      repositories: previewRepositories,
      revision: 1,
      status: "pending",
    },
    { onExcessProperty: "error" }
  );
  return { ...manifest, document: previewDocument };
}

/** Creates one sanitized compiler failure without an older artifact. */
export function makeFailedManifest() {
  const manifest = Schema.decodeSync(PreviewFailedSchema)(
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
  return { ...manifest, document: previewDocument };
}
