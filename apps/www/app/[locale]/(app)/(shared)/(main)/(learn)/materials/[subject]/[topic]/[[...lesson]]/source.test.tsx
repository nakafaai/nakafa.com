// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Cause, Effect, Option, Runtime } from "effect";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readMaterialMetadata,
  readMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import {
  PreviewCompileError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";
import {
  previewMetadata,
  previewProjection,
  previewPublicRoute,
  previewSourcePath,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  applyContentRuntimeCache: vi.fn(),
  connection: vi.fn(),
  getAksaraUrl: vi.fn(),
  getGithubUrl: vi.fn(),
  getMaterialPageData: vi.fn(),
  getPublishedMaterial: vi.fn(),
  getActiveContentIdentity: vi.fn(),
  hasPreviewConfig: vi.fn(),
  importContentModuleOrNull: vi.fn(),
  isMaterialLessonRoute: vi.fn(),
  notFound: vi.fn(),
  readActiveContentRoute: vi.fn(),
  readMaterialPreview: vi.fn(),
  readMaterialRequest: vi.fn(),
  readMaterialRoute: vi.fn(),
  renderPublishedMaterial: vi.fn(),
}));

vi.mock("@repo/contents/_types/route/content", () => ({
  isMaterialLessonRoute: mocks.isMaterialLessonRoute,
}));
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data",
  () => ({
    readMaterialRequest: mocks.readMaterialRequest,
    readMaterialRoute: mocks.readMaterialRoute,
  })
);
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/runtime",
  () => ({
    getMaterialPageData: mocks.getMaterialPageData,
  })
);
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: mocks.applyContentRuntimeCache,
}));
vi.mock("@/lib/content/module", () => ({
  importContentModuleOrNull: mocks.importContentModuleOrNull,
}));
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: mocks.hasPreviewConfig,
}));
vi.mock("@/lib/content/preview/material", () => ({
  readMaterialPreview: mocks.readMaterialPreview,
}));
vi.mock("@/lib/content/published/material", () => ({
  getPublishedMaterial: mocks.getPublishedMaterial,
  renderPublishedMaterial: mocks.renderPublishedMaterial,
}));
vi.mock("@/lib/content/published/active", () => ({
  getActiveContentIdentity: mocks.getActiveContentIdentity,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: mocks.readActiveContentRoute,
}));
vi.mock("@/lib/utils/github", () => ({
  getAksaraUrl: mocks.getAksaraUrl,
  getGithubUrl: mocks.getGithubUrl,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));
vi.mock("next/server", () => ({
  connection: mocks.connection,
}));

const routeParams = {
  lesson: ["function-concept"],
  locale: "en",
  subject: "mathematics",
  topic: "function-composition-inverse-function",
};
const publicPath = previewPublicRoute.publicPath;
const sourceBody = "## Function concept";
const sourceUrl = "https://github.com/nakafaai/nakafa.com/source";
const aksaraUrl = "https://github.com/nakafaai/aksara/source";
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const activeReleaseId = ReleaseIdSchema.make("release-active");

/** Produces a fresh framework params promise for one material request. */
function params() {
  return Promise.resolve(routeParams);
}

/** Extracts the typed Effect failure preserved by a framework promise boundary. */
async function readRejectedFailure(read: () => Promise<unknown>) {
  const rejected = await Effect.runPromise(
    Effect.tryPromise(read).pipe(
      Effect.catchTag("UnknownException", ({ error }) => Effect.succeed(error))
    )
  );
  if (!Runtime.isFiberFailure(rejected)) {
    throw new Error("Expected an Effect FiberFailure.");
  }
  const failure = Cause.failureOption(rejected[Runtime.FiberFailureCauseId]);
  if (Option.isNone(failure)) {
    throw new Error("Expected a typed Effect failure.");
  }

  return failure.value;
}

/** Component identity used to prove the selected preview is rendered. */
function PreviewContent() {
  return <p>Preview content</p>;
}

/** Component identity used to prove the native source module is rendered. */
function SourceContent() {
  return <p>Source content</p>;
}

/** Exact selected local overlay used by preview ownership tests. */
const previewContent = {
  Content: PreviewContent,
  locale: "en",
  metadata: previewMetadata,
  rawMdx: "## Preview function concept",
  rendererDomain: "mathematics",
  route: previewPublicRoute,
};

/** Exact current native runtime row used by source ownership tests. */
const sourceData = {
  body: sourceBody,
  metadata: previewMetadata,
};

/** Resets every seam to one valid unmanaged native material route. */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPreviewConfig.mockReturnValue(false);
  mocks.connection.mockResolvedValue(undefined);
  mocks.readMaterialPreview.mockReturnValue(Effect.succeed(Option.none()));
  mocks.readMaterialRequest.mockResolvedValue({
    locale: "en",
    publicPath,
  });
  mocks.getActiveContentIdentity.mockResolvedValue(null);
  mocks.readActiveContentRoute.mockReturnValue(
    Effect.succeed({ activeReleaseId: null, kind: "unmanaged" })
  );
  mocks.readMaterialRoute.mockResolvedValue({
    locale: "en",
    route: previewPublicRoute,
  });
  mocks.isMaterialLessonRoute.mockReturnValue(true);
  mocks.getMaterialPageData.mockResolvedValue(sourceData);
  mocks.importContentModuleOrNull.mockResolvedValue({
    default: SourceContent,
  });
  mocks.getGithubUrl.mockReturnValue(sourceUrl);
  mocks.getAksaraUrl.mockReturnValue(aksaraUrl);
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

describe("material page source", () => {
  it("renders a ready preview before consulting either content catalog", async () => {
    mocks.hasPreviewConfig.mockReturnValue(true);
    mocks.readMaterialPreview.mockReturnValue(
      Effect.succeed(Option.some(previewContent))
    );

    const [page, metadata] = await Promise.all([
      readMaterialPage(params()),
      readMaterialMetadata(params()),
    ]);

    expect(page).toMatchObject({
      body: previewContent.rawMdx,
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
      sourceUrl: null,
    });
    expect(isValidElement(page.children)).toBe(true);
    if (isValidElement(page.children)) {
      expect(page.children.type).toBe(PreviewContent);
    }
    expect(metadata).toEqual({
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
    });
    expect(mocks.connection).toHaveBeenCalledTimes(2);
    expect(mocks.readMaterialRequest).not.toHaveBeenCalled();
    expect(mocks.readActiveContentRoute).not.toHaveBeenCalled();
    expect(mocks.getActiveContentIdentity).not.toHaveBeenCalled();
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
  });

  it.each([
    new PreviewPendingError({ revision: 2 }),
    new PreviewCompileError({
      code: "MDX_PARSE",
      message: "Compilation failed.",
      revision: 3,
    }),
  ])("preserves the selected preview failure %#", async (error) => {
    mocks.hasPreviewConfig.mockReturnValue(true);
    mocks.readMaterialPreview.mockReturnValue(Effect.fail(error));

    await expect(
      readRejectedFailure(() => readMaterialPage(params()))
    ).resolves.toBe(error);
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.readMaterialRequest).not.toHaveBeenCalled();
  });

  it("uses published ownership when preview is disabled", async () => {
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        kind: "found",
        projection: previewProjection,
        rendererDomain: "mathematics",
      })
    );
    mocks.getActiveContentIdentity.mockResolvedValue({
      releaseId: activeReleaseId,
    });
    mocks.getPublishedMaterial.mockResolvedValue({
      metadata: previewMetadata,
      route: previewPublicRoute,
    });

    await expect(readMaterialMetadata(params())).resolves.toEqual({
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
    });
    expect(mocks.readMaterialPreview).not.toHaveBeenCalled();
    expect(mocks.applyContentRuntimeCache).toHaveBeenCalledOnce();
    expect(mocks.readActiveContentRoute).toHaveBeenCalledWith({
      activeReleaseId,
      family: "material",
      locale: "en",
      publicPath,
    });
    expect(mocks.getPublishedMaterial).toHaveBeenCalledWith({
      activeReleaseId,
      locale: "en",
      publicPath,
    });
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
  });

  it("uses normal ownership when an enabled preview selects another route", async () => {
    mocks.hasPreviewConfig.mockReturnValue(true);

    await expect(readMaterialMetadata(params())).resolves.toEqual({
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
    });
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.readMaterialPreview).toHaveBeenCalledOnce();
    expect(mocks.readActiveContentRoute).toHaveBeenCalledOnce();
    expect(mocks.readMaterialRoute).toHaveBeenCalledOnce();
  });

  it("hard-fails an owned deletion without reading the native source", async () => {
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({ activeReleaseId, kind: "missing" })
    );
    mocks.getActiveContentIdentity.mockResolvedValue({
      releaseId: activeReleaseId,
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
  });

  it("never falls back when activation changes after ownership identity", async () => {
    const mismatch = new PublishedReleaseMismatchError({
      actualReleaseId: activeReleaseId,
      expectedReleaseId: null,
    });
    mocks.readActiveContentRoute.mockReturnValue(Effect.fail(mismatch));

    await expect(
      readRejectedFailure(() => readMaterialPage(params()))
    ).resolves.toBe(mismatch);
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
  });

  it("routes every published material domain through the shared renderer", async () => {
    const body = <p>Chemistry body</p>;
    mocks.readActiveContentRoute.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        kind: "found",
        projection: previewProjection,
        rendererDomain: "chemistry",
      })
    );
    mocks.getActiveContentIdentity.mockResolvedValue({
      releaseId: activeReleaseId,
    });
    mocks.renderPublishedMaterial.mockResolvedValue({
      body,
      metadata: previewMetadata,
      rawMdx: "## Chemistry concept",
      route: previewPublicRoute,
      sourcePath: previewSourcePath,
      sourceRevision: null,
    });

    await expect(readMaterialPage(params())).resolves.toMatchObject({
      body: "## Chemistry concept",
      children: body,
    });
    expect(mocks.renderPublishedMaterial).toHaveBeenCalledWith({
      activeReleaseId,
      locale: "en",
      publicPath,
    });
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
  });

  it.each([
    ["immutable Git source", sourceRevision, aksaraUrl],
    ["rollback without Git source", null, null],
  ])(
    "renders published body and metadata with %s",
    async (_label, revision, expectedSourceUrl) => {
      const body = <p>Published body</p>;
      mocks.readActiveContentRoute.mockReturnValue(
        Effect.succeed({
          activeReleaseId,
          kind: "found",
          projection: previewProjection,
          rendererDomain: "mathematics",
        })
      );
      mocks.getActiveContentIdentity.mockResolvedValue({
        releaseId: activeReleaseId,
      });
      mocks.renderPublishedMaterial.mockResolvedValue({
        body,
        metadata: previewMetadata,
        rawMdx: "## Published function concept",
        route: previewPublicRoute,
        sourcePath: previewSourcePath,
        sourceRevision: revision,
      });

      const page = await readMaterialPage(params());

      expect(page).toEqual({
        body: "## Published function concept",
        children: body,
        locale: "en",
        metadata: previewMetadata,
        route: previewPublicRoute,
        sourceUrl: expectedSourceUrl,
      });
      if (revision) {
        expect(mocks.getAksaraUrl).toHaveBeenCalledWith({
          path: previewSourcePath,
          revision,
        });
      } else {
        expect(mocks.getAksaraUrl).not.toHaveBeenCalled();
      }
      expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
      expect(mocks.renderPublishedMaterial).toHaveBeenCalledWith({
        activeReleaseId,
        locale: "en",
        publicPath,
      });
    }
  );

  it("renders one unmanaged native source and its existing edit URL", async () => {
    const [page, metadata] = await Promise.all([
      readMaterialPage(params()),
      readMaterialMetadata(params()),
    ]);

    expect(page).toMatchObject({
      body: sourceBody,
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
      sourceUrl,
    });
    expect(isValidElement(page.children)).toBe(true);
    if (isValidElement(page.children)) {
      expect(page.children.type).toBe(SourceContent);
    }
    expect(metadata).toEqual({
      locale: "en",
      metadata: previewMetadata,
      route: previewPublicRoute,
    });
    expect(mocks.getGithubUrl).toHaveBeenCalledWith({
      path: `/packages/contents/${previewPublicRoute.sourcePath}/en.mdx`,
    });
  });

  it("returns absent native metadata without inventing a value", async () => {
    mocks.getMaterialPageData.mockResolvedValue(null);

    await expect(readMaterialMetadata(params())).resolves.toEqual({
      locale: "en",
      metadata: undefined,
      route: previewPublicRoute,
    });
  });

  it.each([
    ["runtime row", null, { default: SourceContent }],
    ["compiled module", sourceData, null],
  ])(
    "hard-fails a missing native %s",
    async (_label, runtimeRow, contentModule) => {
      mocks.getMaterialPageData.mockResolvedValue(runtimeRow);
      mocks.importContentModuleOrNull.mockResolvedValue(contentModule);

      await expect(readMaterialPage(params())).rejects.toThrow(
        "NEXT_NOT_FOUND"
      );
    }
  );

  it.each([
    ["missing route", undefined, true],
    ["non-lesson route", previewPublicRoute, false],
  ])("hard-fails an unmanaged %s", async (_label, route, isLesson) => {
    mocks.readMaterialRoute.mockResolvedValue({ locale: "en", route });
    mocks.isMaterialLessonRoute.mockReturnValue(isLesson);

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
  });

  it("hard-fails when the localized namespace cannot produce a public path", async () => {
    mocks.readMaterialRequest.mockResolvedValue({
      locale: "en",
      publicPath: undefined,
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.readActiveContentRoute).not.toHaveBeenCalled();
    expect(mocks.getActiveContentIdentity).not.toHaveBeenCalled();
    expect(mocks.readMaterialRoute).not.toHaveBeenCalled();
  });
});
