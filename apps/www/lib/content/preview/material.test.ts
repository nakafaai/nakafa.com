// @vitest-environment node

import { beforeEach, expect, layer } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  MaterialLessonRouteSchema,
  makeMaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { readPreviewConfig } from "@/lib/content/preview/config";
import {
  type MaterialPreviewInput,
  readMaterialPreview,
} from "@/lib/content/preview/material";
import { fetchPreviewJson } from "@/lib/content/preview/request";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  previewWireArtifact as artifact,
  previewArtifactHash as artifactHash,
  previewConfig as config,
  previewKeyId as keyId,
  makeFailedManifest,
  makeMaterialGraph,
  makePendingManifest,
  makePreviewInput,
  makeReadyManifest,
  previewManifestHash as manifestHash,
  previewMetadata as metadata,
  previewWireMdx,
  previewProjection as projection,
  previewRoute as route,
} from "@/test/content-preview";
import { articlePendingManifest } from "@/test/preview-article";

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("next-intl", () => ({
  /** Keeps route rendering independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("@/lib/content/preview/config", async (importOriginal) => ({
  ...(await importOriginal()),
  readPreviewConfig: vi.fn(),
}));
vi.mock("@/lib/content/preview/request", () => ({
  fetchPreviewJson: vi.fn(),
  MAX_PREVIEW_MANIFEST_BYTES: 128 * 1024,
}));
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: vi.fn(),
}));

const input: MaterialPreviewInput = makePreviewInput();

const configMock = vi.mocked(readPreviewConfig);
const fetchMock = vi.mocked(fetchPreviewJson);
const executeMock = vi.mocked(executeSignedArtifact);

type ReadyMaterialManifestValue = ReturnType<typeof makeReadyManifest>;

/** Shared ready fixture derived once from the deployed renderer contract. */
class ReadyMaterialManifest extends Context.Service<
  ReadyMaterialManifest,
  ReadyMaterialManifestValue
>()("www.test.ReadyMaterialManifest") {
  static readonly layer = Layer.effect(
    this,
    rendererManifest.pipe(
      Effect.map((activeManifest) => makeReadyManifest(activeManifest.hash))
    )
  );
}

/** Runs the material preview program with its typed failures preserved. */
function runPreview(request = input) {
  return readMaterialPreview(request);
}

/** Returns one expected material preview failure. */
function runFailure(request = input) {
  return runPreview(request).pipe(Effect.flip);
}

beforeEach(() => {
  configMock.mockReset();
  fetchMock.mockReset();
  executeMock.mockReset();
  configMock.mockReturnValue(Effect.succeed(Option.some(config)));
  executeMock.mockImplementation(() =>
    Effect.gen(function* () {
      const resolver = yield* ContentVerificationKeyResolver;
      yield* resolver.resolve(keyId);
      return { artifact, Content: () => null };
    })
  );
});

layer(ReadyMaterialManifest.layer)("local material preview", (it) => {
  it.effect(
    "rejects a malformed provider manifest before route selection",
    () =>
      Effect.gen(function* () {
        fetchMock.mockReturnValueOnce(Effect.succeed({ status: "ready" }));
        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewIntegrityError",
          check: "manifest",
        });
      })
  );

  it.effect(
    "leaves production and unchanged routes on their existing source",
    () =>
      Effect.gen(function* () {
        const manifest = yield* ReadyMaterialManifest;
        configMock.mockReturnValueOnce(Effect.succeed(Option.none()));
        expect(yield* runPreview()).toEqual(Option.none());

        fetchMock.mockReturnValueOnce(Effect.succeed(manifest));
        expect(
          yield* runPreview({
            ...input,
            params: { ...input.params, topic: `${input.params.topic}-other` },
          })
        ).toEqual(Option.none());
        expect(executeMock).not.toHaveBeenCalled();
      })
  );

  it.effect("leaves a selected article on its own preview renderer", () =>
    Effect.gen(function* () {
      fetchMock.mockReturnValueOnce(Effect.succeed(articlePendingManifest));

      expect(yield* runPreview()).toEqual(Option.none());
      expect(executeMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails closed while a changed route compiles or reports an error",
    () =>
      Effect.gen(function* () {
        fetchMock
          .mockReturnValueOnce(Effect.succeed(makePendingManifest()))
          .mockReturnValueOnce(Effect.succeed(makeFailedManifest()));

        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewPendingError",
          revision: 1,
        });
        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewCompileError",
          code: "MDX_PARSE",
          message: "Compilation failed.",
        });
      })
  );

  it.effect(
    "renders the authenticated ready artifact and its exact metadata",
    () =>
      Effect.gen(function* () {
        const manifest = yield* ReadyMaterialManifest;
        fetchMock
          .mockReturnValueOnce(Effect.succeed(manifest))
          .mockReturnValueOnce(Effect.succeed(artifact));

        const result = yield* runPreview();
        expect(Option.getOrUndefined(result)).toMatchObject({
          metadata,
          rawMdx: previewWireMdx,
        });
        expect(fetchMock).toHaveBeenNthCalledWith(
          2,
          config,
          `/v1/artifacts/${encodeURIComponent(artifactHash)}`,
          expect.any(Number)
        );
        expect(executeMock).toHaveBeenCalledWith(
          expect.not.objectContaining({ components: expect.anything() })
        );
      })
  );

  it.effect("renders a ready lesson route absent from the static catalog", () =>
    Effect.gen(function* () {
      const manifest = yield* ReadyMaterialManifest;
      const newRoute = yield* Schema.decodeEffect(MaterialLessonRouteSchema)({
        ...route,
        contentKey: ContentKeySchema.make(
          "material/lesson/mathematics/function-composition-inverse-function/new-concept"
        ),
        graph: makeMaterialGraph(
          "mathematics",
          "function-composition-inverse-function",
          "new-concept",
          "en"
        ),
        order: 6,
        publicPath:
          "subjects/mathematics/function-composition-inverse-function/new-concept",
        sectionKey: "new-concept",
      });
      const newProjection = makeMaterialLessonProjection(newRoute, metadata);
      const newArtifact = yield* Schema.decodeEffect(
        SignedContentArtifactSchema
      )({
        ...artifact,
        payload: { ...artifact.payload, contentKey: newRoute.contentKey },
      });
      fetchMock
        .mockReturnValueOnce(
          Effect.succeed({
            ...manifest,
            document: { ...manifest.document, route: newRoute },
            artifacts: [
              {
                ...manifest.artifacts[0],
                projection: newProjection,
              },
            ],
          })
        )
        .mockReturnValueOnce(Effect.succeed(newArtifact));
      executeMock.mockReturnValueOnce(
        Effect.succeed({ artifact: newArtifact, Content: () => null })
      );

      const result = yield* runPreview({
        ...input,
        params: { ...input.params, lesson: ["new-concept"] },
      });

      expect(Option.getOrUndefined(result)?.projection).toMatchObject({
        contentKey: newRoute.contentKey,
        publicPath: newRoute.publicPath,
      });
    })
  );

  it.effect.each([
    [
      "renderer",
      "renderer",
      (_manifest: ReadyMaterialManifestValue) => ({
        rendererManifestHash: manifestHash,
      }),
    ],
    [
      "projection",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: {
              ...projection,
              contentKey: ContentKeySchema.make("material/foreign"),
            },
          },
        ],
      }),
    ],
    [
      "projection app locale",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: { ...projection, appLocale: "id" },
          },
        ],
      }),
    ],
    [
      "projection material key",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: {
              ...projection,
              materialKey: "lesson.mathematics.other",
            },
          },
        ],
      }),
    ],
    [
      "projection order",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: { ...projection, order: 6 },
          },
        ],
      }),
    ],
    [
      "projection path",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: {
              ...projection,
              publicPath: `${route.publicPath}-other`,
            },
          },
        ],
      }),
    ],
    [
      "projection section",
      "manifest",
      (manifest: ReadyMaterialManifestValue) => ({
        artifacts: [
          {
            ...manifest.artifacts[0],
            projection: { ...projection, sectionKey: "other-section" },
          },
        ],
      }),
    ],
  ] as const)("rejects an incoherent %s field", ([_label, check, makeChange]) =>
    Effect.gen(function* () {
      const manifest = yield* ReadyMaterialManifest;
      fetchMock.mockReturnValueOnce(
        Effect.succeed({ ...manifest, ...makeChange(manifest) })
      );
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewIntegrityError",
        check,
      });
    })
  );

  it.effect.each([
    ["hash", { artifactHash: manifestHash }],
    [
      "content key",
      {
        payload: {
          ...artifact.payload,
          contentKey: ContentKeySchema.make("material/foreign"),
        },
      },
    ],
    [
      "artifact locale",
      { payload: { ...artifact.payload, artifactLocale: "id" } },
    ],
    ["domain", { payload: { ...artifact.payload, rendererDomain: "physics" } }],
  ] as const)("rejects an artifact with a mismatched %s", ([_label, change]) =>
    Effect.gen(function* () {
      const manifest = yield* ReadyMaterialManifest;
      const changedArtifact = yield* Schema.decodeEffect(
        SignedContentArtifactSchema
      )({ ...artifact, ...change });
      fetchMock
        .mockReturnValueOnce(Effect.succeed(manifest))
        .mockReturnValueOnce(Effect.succeed(changedArtifact));
      executeMock.mockReturnValueOnce(
        Effect.succeed({ artifact: changedArtifact, Content: () => null })
      );

      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "artifact",
      });
    })
  );

  it.effect("rejects an artifact signed by any other ephemeral key", () =>
    Effect.gen(function* () {
      const manifest = yield* ReadyMaterialManifest;
      const foreignKey = SigningKeyIdSchema.make("foreign-preview");
      fetchMock
        .mockReturnValueOnce(Effect.succeed(manifest))
        .mockReturnValueOnce(Effect.succeed(artifact));
      executeMock.mockReturnValueOnce(
        Effect.gen(function* () {
          const resolver = yield* ContentVerificationKeyResolver;
          yield* resolver.resolve(foreignKey);
          return { artifact, Content: () => null };
        })
      );

      expect(yield* runFailure()).toBeInstanceOf(SigningKeyNotFoundError);
    })
  );
});
