// @vitest-environment node

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
import { Effect, Either, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFixedMaterialRuntimeResolver,
  MaterialRegistryMissingError,
} from "@/lib/content/material";
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

vi.mock("server-only", () => ({}));
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

const components = {};
const unusedRuntimeError = new MaterialRegistryMissingError({
  rendererDomain: "mathematics",
});
const resolveRuntime = createFixedMaterialRuntimeResolver({
  components,
  importer: () => Promise.reject(unusedRuntimeError),
  published: () => Promise.reject(unusedRuntimeError),
  rendererDomain: "mathematics",
});
const input: MaterialPreviewInput = makePreviewInput(resolveRuntime);

const configMock = vi.mocked(readPreviewConfig);
const fetchMock = vi.mocked(fetchPreviewJson);
const executeMock = vi.mocked(executeSignedArtifact);
const activeManifest = await Effect.runPromise(rendererManifest);

/** Creates the ready state for the currently deployed renderer contract. */
function readyManifest() {
  return makeReadyManifest(activeManifest.hash);
}

/** Runs the material preview program with its typed failures preserved. */
function runPreview(request = input) {
  return Effect.runPromise(readMaterialPreview(request));
}

/** Returns one expected material preview failure. */
function runFailure(request = input) {
  return Effect.runPromise(readMaterialPreview(request).pipe(Effect.flip));
}

/** Creates an async assertion for one expected preview failure. */
function expectPreviewFailure(request = input) {
  return expect(runFailure(request)).resolves;
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

describe("local material preview", () => {
  it("rejects a malformed provider manifest before route selection", async () => {
    fetchMock.mockReturnValueOnce(Effect.succeed({ status: "ready" }));
    await expectPreviewFailure().toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });
  });

  it("leaves production and unchanged routes on their existing source", async () => {
    configMock.mockReturnValueOnce(Effect.succeed(Option.none()));
    await expect(runPreview()).resolves.toEqual(Option.none());

    fetchMock.mockReturnValueOnce(Effect.succeed(readyManifest()));
    await expect(
      runPreview({
        ...input,
        params: { ...input.params, topic: `${input.params.topic}-other` },
      })
    ).resolves.toEqual(Option.none());
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("fails closed while a changed route compiles or reports an error", async () => {
    fetchMock
      .mockReturnValueOnce(Effect.succeed(makePendingManifest()))
      .mockReturnValueOnce(Effect.succeed(makeFailedManifest()));

    await expectPreviewFailure().toMatchObject({
      _tag: "PreviewPendingError",
      revision: 1,
    });
    await expectPreviewFailure().toMatchObject({
      _tag: "PreviewCompileError",
      code: "MDX_PARSE",
      message: "Compilation failed.",
    });
  });

  it("renders the authenticated ready artifact and its exact metadata", async () => {
    fetchMock
      .mockReturnValueOnce(Effect.succeed(readyManifest()))
      .mockReturnValueOnce(Effect.succeed(artifact));

    const result = await runPreview();
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
      expect.objectContaining({ components })
    );
  });

  it("fails before artifact fetch when the physical registry is unavailable", async () => {
    const error = new MaterialRegistryMissingError({
      rendererDomain: "mathematics",
    });
    fetchMock.mockReturnValueOnce(Effect.succeed(readyManifest()));

    await expectPreviewFailure({
      ...input,
      resolveRuntime: () => Either.left(error),
    }).toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "domain",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("renders a ready lesson route absent from the static catalog", async () => {
    const newRoute = Schema.decodeUnknownSync(MaterialLessonRouteSchema)({
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
    const newArtifact = Schema.decodeUnknownSync(SignedContentArtifactSchema)({
      ...artifact,
      payload: { ...artifact.payload, contentKey: newRoute.contentKey },
    });
    fetchMock
      .mockReturnValueOnce(
        Effect.succeed({
          ...readyManifest(),
          document: { ...readyManifest().document, route: newRoute },
          projection: newProjection,
        })
      )
      .mockReturnValueOnce(Effect.succeed(newArtifact));
    executeMock.mockReturnValueOnce(
      Effect.succeed({ artifact: newArtifact, Content: () => null })
    );

    const result = await runPreview({
      ...input,
      params: { ...input.params, lesson: ["new-concept"] },
    });

    expect(Option.getOrUndefined(result)?.route).toMatchObject({
      publicPath: newRoute.publicPath,
      sourcePath: newRoute.contentKey,
    });
  });

  it.each([
    [
      "delivery",
      "delivery",
      { document: { ...readyManifest().document, delivery: "entitled" } },
    ],
    ["renderer", "renderer", { rendererManifestHash: manifestHash }],
    [
      "projection",
      "projection",
      {
        projection: {
          ...projection,
          contentKey: ContentKeySchema.make("material/foreign"),
        },
      },
    ],
    ["projection locale", "manifest", { projection: { ...projection, locale: "id" } }],
    [
      "projection material key",
      "manifest",
      {
        projection: { ...projection, materialKey: "lesson.mathematics.other" },
      },
    ],
    ["projection order", "projection", { projection: { ...projection, order: 6 } }],
    [
      "projection path",
      "projection",
      {
        projection: { ...projection, publicPath: `${route.publicPath}-other` },
      },
    ],
    [
      "projection section",
      "manifest",
      { projection: { ...projection, sectionKey: "other-section" } },
    ],
  ])("rejects an incoherent %s field", async (_label, check, change) => {
    fetchMock.mockReturnValueOnce(
      Effect.succeed({ ...readyManifest(), ...change })
    );
    await expectPreviewFailure().toMatchObject({
      _tag: "PreviewIntegrityError",
      check,
    });
  });

  it.each([
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
    ["locale", { payload: { ...artifact.payload, locale: "id" } }],
    ["domain", { payload: { ...artifact.payload, rendererDomain: "physics" } }],
  ])("rejects an artifact with a mismatched %s", async (_label, change) => {
    const changedArtifact = Schema.decodeUnknownSync(
      SignedContentArtifactSchema
    )({ ...artifact, ...change });
    fetchMock
      .mockReturnValueOnce(Effect.succeed(readyManifest()))
      .mockReturnValueOnce(Effect.succeed(changedArtifact));
    executeMock.mockReturnValueOnce(
      Effect.succeed({ artifact: changedArtifact, Content: () => null })
    );

    await expectPreviewFailure().toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "artifact",
    });
  });

  it("rejects an artifact signed by any other ephemeral key", async () => {
    const foreignKey = SigningKeyIdSchema.make("foreign-preview");
    fetchMock
      .mockReturnValueOnce(Effect.succeed(readyManifest()))
      .mockReturnValueOnce(Effect.succeed(artifact));
    executeMock.mockReturnValueOnce(
      Effect.gen(function* () {
        const resolver = yield* ContentVerificationKeyResolver;
        yield* resolver.resolve(foreignKey);
        return { artifact, Content: () => null };
      })
    );

    await expectPreviewFailure().toBeInstanceOf(SigningKeyNotFoundError);
  });
});
