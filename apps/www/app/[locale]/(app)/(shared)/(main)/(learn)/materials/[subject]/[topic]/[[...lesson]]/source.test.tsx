// @vitest-environment node

import {
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Cause, Effect, Option, Runtime } from "effect";
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readMaterialMetadata,
  readMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import type { MaterialSourceClaim } from "@/lib/content/material/ownership";
import type { PublishedMaterialRoute } from "@/lib/content/material/route";
import {
  PreviewCompileError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import type { MaterialPreviewContent } from "@/lib/content/preview/material";
import {
  previewIdProjection,
  previewMetadata,
  previewNextProjection,
  previewProjection,
  previewPublicRoute,
  previewSourcePath,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  expandMaterialCandidates: vi.fn(),
  getAksaraUrl: vi.fn(),
  getGithubUrl: vi.fn(),
  getMaterialPageData: vi.fn(),
  getPublishedMaterialRoute: vi.fn(),
  hasPreviewConfig: vi.fn(),
  importContentModuleOrNull: vi.fn(),
  isMaterialLessonRoute: vi.fn(),
  notFound: vi.fn(),
  readMaterialPreview: vi.fn(),
  readMaterialRequest: vi.fn(),
  readMaterialSource: vi.fn(),
  renderPublishedMaterial: vi.fn(),
  verifyReleasePin: vi.fn(),
}));

vi.mock("@repo/contents/_types/route/content", () => ({
  isMaterialLessonRoute: mocks.isMaterialLessonRoute,
}));
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data",
  () => ({
    readMaterialRequest: mocks.readMaterialRequest,
  })
);
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/runtime",
  () => ({ getMaterialPageData: mocks.getMaterialPageData })
);
vi.mock("@/lib/content/material/route", () => ({
  getPublishedMaterialRoute: mocks.getPublishedMaterialRoute,
}));
vi.mock("@/lib/content/material/release", () => ({
  verifyStaticMaterialReleasePin: mocks.verifyReleasePin,
}));
vi.mock("@/lib/content/material/shell", () => ({
  expandMaterialCandidates: mocks.expandMaterialCandidates,
  readMaterialSource: mocks.readMaterialSource,
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
  renderPublishedMaterial: mocks.renderPublishedMaterial,
}));
vi.mock("@/lib/utils/github", () => ({
  getAksaraUrl: mocks.getAksaraUrl,
  getGithubUrl: mocks.getGithubUrl,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/server", () => ({ connection: mocks.connection }));

const routeParams = {
  lesson: ["function-concept"],
  locale: "en",
  subject: "mathematics",
  topic: "function-composition-inverse-function",
};
const activeReleaseId = ReleaseIdSchema.make("release-active");
const activeManifestHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const sourceBody = "## Function concept";
const sourceUrl = "https://github.com/nakafaai/nakafa.com/source";
const aksaraUrl = "https://github.com/nakafaai/aksara/source";
/** Produces fresh framework params for one real material fixture. */
const params = () => Promise.resolve(routeParams);
/** Component proving that the selected preview body reached React. */
const PreviewContent = () => <p>Preview content</p>;

/** Component proving that the selected native body reached React. */
const SourceContent = () => <p>Source content</p>;

const previewContent = {
  Content: PreviewContent,
  locale: previewProjection.locale,
  metadata: previewMetadata,
  projection: previewProjection,
  rawMdx: "## Preview function concept",
  rendererDomain: "mathematics",
} satisfies MaterialPreviewContent;

const publishedModel = {
  activeManifestHash,
  activeReleaseId,
  alternates: [previewProjection, previewIdProjection],
  familyManaged: true,
  managed: true,
  projection: previewProjection,
  rendererDomain: "mathematics",
  siblings: [previewProjection],
  sourceClaims: [],
  sourceMaterials: [],
  sourcePath: previewSourcePath,
  sourceRevision,
} satisfies PublishedMaterialRoute;

const unmanagedModel = {
  activeManifestHash: null,
  activeReleaseId: null,
  alternates: [],
  familyManaged: false,
  managed: false,
  projection: null,
  rendererDomain: null,
  siblings: [],
  sourceClaims: [],
  sourceMaterials: [],
  sourcePath: null,
  sourceRevision: null,
} satisfies PublishedMaterialRoute;

/** Extracts a typed Effect failure crossing the framework promise boundary. */
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPreviewConfig.mockReturnValue(false);
  mocks.connection.mockResolvedValue(undefined);
  mocks.readMaterialPreview.mockReturnValue(Effect.succeed(Option.none()));
  mocks.verifyReleasePin
    .mockReset()
    .mockImplementation((releaseId) => Promise.resolve(releaseId));
  mocks.expandMaterialCandidates.mockImplementation((candidates) => candidates);
  mocks.readMaterialRequest.mockResolvedValue({
    locale: "en",
    publicPath: previewProjection.publicPath,
  });
  mocks.getPublishedMaterialRoute.mockResolvedValue(unmanagedModel);
  mocks.readMaterialSource.mockReturnValue({
    candidates: [],
    route: previewPublicRoute,
  });
  mocks.isMaterialLessonRoute.mockReturnValue(true);
  mocks.getMaterialPageData.mockResolvedValue({
    body: sourceBody,
    metadata: previewMetadata,
  });
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
  it("renders a selected preview before either persistent owner", async () => {
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
      kind: "preview",
      metadata: previewMetadata,
      rendererDomain: "mathematics",
      route: previewProjection,
      sourceUrl: null,
    });
    expect(isValidElement(page.children)).toBe(true);
    expect(metadata).toMatchObject({
      kind: "preview",
      metadata: previewMetadata,
      route: previewProjection,
    });
    expect(mocks.getPublishedMaterialRoute).not.toHaveBeenCalled();
    expect(mocks.readMaterialSource).not.toHaveBeenCalled();
  });

  it.each([
    new PreviewPendingError({ revision: 2 }),
    new PreviewCompileError({
      code: "MDX_PARSE",
      message: "Compilation failed.",
      revision: 3,
    }),
  ])("preserves selected preview failure %#", async (error) => {
    mocks.hasPreviewConfig.mockReturnValue(true);
    mocks.readMaterialPreview.mockReturnValue(Effect.fail(error));

    await expect(
      readRejectedFailure(() => readMaterialPage(params()))
    ).resolves.toBe(error);
    expect(mocks.getPublishedMaterialRoute).not.toHaveBeenCalled();
  });

  it("reads managed metadata without fetching an artifact body", async () => {
    mocks.getPublishedMaterialRoute.mockResolvedValue(publishedModel);

    await expect(readMaterialMetadata(params())).resolves.toEqual({
      alternates: publishedModel.alternates,
      familyManaged: true,
      kind: "published",
      locale: "en",
      metadata: previewMetadata,
      route: previewProjection,
      sourceClaims: [],
    });
    expect(mocks.renderPublishedMaterial).not.toHaveBeenCalled();
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
  });

  it("reconciles a renamed exact owner from its stable source identity", async () => {
    const candidates = [
      {
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
      },
    ];
    const initial = {
      ...publishedModel,
      familyManaged: false,
      sourceClaims: [],
    } satisfies PublishedMaterialRoute;
    const reconciled = {
      ...initial,
      sourceClaims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: previewProjection.locale,
          projection: previewProjection,
        },
      ],
    } satisfies PublishedMaterialRoute;
    mocks.readMaterialSource.mockReturnValue({
      candidates: [
        {
          contentKey: previewNextProjection.contentKey,
          locale: previewNextProjection.locale,
        },
      ],
      route: undefined,
    });
    mocks.expandMaterialCandidates.mockReturnValueOnce(candidates);
    mocks.getPublishedMaterialRoute
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(reconciled);

    await expect(readMaterialMetadata(params())).resolves.toMatchObject({
      familyManaged: false,
      kind: "published",
      sourceClaims: reconciled.sourceClaims,
    });
    expect(mocks.expandMaterialCandidates).toHaveBeenCalledWith(
      [
        {
          contentKey: previewNextProjection.contentKey,
          locale: previewNextProjection.locale,
        },
      ],
      [previewProjection]
    );
    expect(mocks.getPublishedMaterialRoute).toHaveBeenNthCalledWith(
      2,
      previewProjection.locale,
      previewProjection.publicPath,
      candidates,
      initial.activeReleaseId
    );
  });

  it("keeps a published owner when its source identity no longer resolves", async () => {
    const publishedOnly = {
      ...publishedModel,
      familyManaged: false,
      sourceClaims: [],
    } satisfies PublishedMaterialRoute;
    mocks.readMaterialSource.mockReturnValue({
      candidates: [],
      route: undefined,
    });
    mocks.getPublishedMaterialRoute.mockResolvedValue(publishedOnly);

    await expect(readMaterialMetadata(params())).resolves.toMatchObject({
      familyManaged: false,
      kind: "published",
      route: previewProjection,
    });
    expect(mocks.expandMaterialCandidates).toHaveBeenCalledWith(
      [],
      [previewProjection]
    );
    expect(mocks.getPublishedMaterialRoute).toHaveBeenCalledTimes(1);
  });

  it("hard-fails a managed deletion without reading source", async () => {
    mocks.getPublishedMaterialRoute.mockResolvedValue({
      ...publishedModel,
      alternates: [],
      projection: null,
      rendererDomain: null,
      siblings: [],
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
  });

  it.each([
    {
      contentKey: previewProjection.contentKey,
      kind: "missing",
      locale: previewProjection.locale,
    } satisfies MaterialSourceClaim,
    {
      contentKey: previewProjection.contentKey,
      kind: "found",
      locale: previewProjection.locale,
      projection: {
        ...previewProjection,
        publicPath: PublicPathSchema.make(
          `${previewProjection.parentPath}/renamed-function`
        ),
      },
    } satisfies MaterialSourceClaim,
  ])("does not revive source body for an exact $kind claim", async (claim) => {
    mocks.getPublishedMaterialRoute.mockResolvedValue({
      ...unmanagedModel,
      sourceClaims: [claim],
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
    expect(mocks.importContentModuleOrNull).not.toHaveBeenCalled();
  });

  it.each([
    ["immutable source", sourceRevision, aksaraUrl],
    ["rollback without revision", null, null],
  ])(
    "renders published body with %s",
    async (_label, revision, expectedUrl) => {
      const body = <p>Published body</p>;
      mocks.getPublishedMaterialRoute.mockResolvedValue(publishedModel);
      mocks.renderPublishedMaterial.mockResolvedValue({
        body,
        metadata: previewMetadata,
        projection: previewProjection,
        rawMdx: "## Published function concept",
        sourcePath: previewSourcePath,
        sourceRevision: revision,
      });

      await expect(readMaterialPage(params())).resolves.toEqual({
        activeReleaseId,
        alternates: publishedModel.alternates,
        body: "## Published function concept",
        children: body,
        familyManaged: true,
        kind: "published",
        locale: "en",
        metadata: previewMetadata,
        rendererDomain: "mathematics",
        route: previewProjection,
        siblings: publishedModel.siblings,
        sourceClaims: [],
        sourceUrl: expectedUrl,
      });
      expect(mocks.renderPublishedMaterial).toHaveBeenCalledWith({
        activeReleaseId,
        locale: "en",
        publicPath: previewProjection.publicPath,
      });
    }
  );

  it("renders the unmanaged source with exact-owned sibling navigation", async () => {
    mocks.getPublishedMaterialRoute.mockResolvedValue({
      ...unmanagedModel,
      sourceMaterials: [previewNextProjection],
    });

    const page = await readMaterialPage(params());

    expect(page).toMatchObject({
      body: sourceBody,
      kind: "source",
      metadata: previewMetadata,
      rendererDomain: null,
      route: previewPublicRoute,
      siblings: [previewNextProjection],
      sourceUrl,
    });
    expect(isValidElement(page.children)).toBe(true);
    expect(mocks.getGithubUrl).toHaveBeenCalledWith({
      path: `/packages/contents/${previewPublicRoute.sourcePath}/en.mdx`,
    });
  });

  it("returns absent source metadata without inventing a value", async () => {
    mocks.getMaterialPageData.mockResolvedValue(null);

    await expect(readMaterialMetadata(params())).resolves.toMatchObject({
      kind: "source",
      metadata: undefined,
      route: previewPublicRoute,
    });
  });

  it.each([
    ["runtime row", null, { default: SourceContent }],
    ["compiled module", { body: sourceBody, metadata: previewMetadata }, null],
  ])("hard-fails a missing source %s", async (_label, row, content) => {
    mocks.getMaterialPageData.mockResolvedValue(row);
    mocks.importContentModuleOrNull.mockResolvedValue(content);

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves published query failure without source fallback", async () => {
    const failure = new Error("published material unavailable");
    mocks.getPublishedMaterialRoute.mockRejectedValue(failure);

    await expect(readMaterialPage(params())).rejects.toBe(failure);
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
  });

  it("rejects a request without one localized public path", async () => {
    mocks.readMaterialRequest.mockResolvedValue({
      locale: "en",
      publicPath: undefined,
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getPublishedMaterialRoute).not.toHaveBeenCalled();
    expect(mocks.readMaterialSource).not.toHaveBeenCalled();
  });

  it("rejects an unmanaged request without one concrete lesson route", async () => {
    mocks.readMaterialSource.mockReturnValue({
      candidates: [],
      route: undefined,
    });

    await expect(readMaterialPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.getMaterialPageData).not.toHaveBeenCalled();
  });
});
