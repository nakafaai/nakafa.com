// @vitest-environment node

import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Option } from "effect";
import { connection } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMaterialRequestRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/resolve";
import {
  getMaterialPageData,
  getMaterialPreviewData,
  getMaterialRouteData,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/runtime";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readMaterialPreview } from "@/lib/content/preview/material";
import { fetchRuntimeCurriculumPage } from "@/lib/content/runtime/pages";
import {
  previewMetadata,
  previewProjection,
  previewWireMdx,
} from "@/test/content-preview";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: vi.fn(),
}));
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: vi.fn(),
}));
vi.mock("@/lib/content/preview/material", () => ({
  readMaterialPreview: vi.fn(),
}));
vi.mock("@/lib/content/runtime/pages", () => ({
  fetchRuntimeCurriculumPage: vi.fn(),
}));
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/resolve",
  () => ({
    readMaterialRequestRoute: vi.fn(),
  })
);

const cacheMock = vi.mocked(applyContentRuntimeCache);
const connectionMock = vi.mocked(connection);
const configMock = vi.mocked(hasPreviewConfig);
const previewMock = vi.mocked(readMaterialPreview);
const runtimeMock = vi.mocked(fetchRuntimeCurriculumPage);
const routeMock = vi.mocked(readMaterialRequestRoute);
const input = {
  components: {} satisfies MDXComponents,
  params: {
    lesson: ["function-concept"],
    locale: "en",
    topic: "function-composition-inverse-function",
  },
  target: "mathematics",
} satisfies Parameters<typeof getMaterialPreviewData>[0];

beforeEach(() => {
  cacheMock.mockReset();
  connectionMock.mockReset();
  configMock.mockReset();
  previewMock.mockReset();
  runtimeMock.mockReset();
  routeMock.mockReset();
});

describe("material route runtime", () => {
  it("avoids starting Effect when no development preview exists", async () => {
    configMock.mockReturnValue(false);

    await expect(getMaterialPreviewData(input)).resolves.toEqual(Option.none());
    expect(connectionMock).not.toHaveBeenCalled();
    expect(previewMock).not.toHaveBeenCalled();
  });

  it("runs the typed preview only in the configured development child", async () => {
    const preview = Option.none();
    configMock.mockReturnValue(true);
    previewMock.mockReturnValue(Effect.succeed(preview));

    await expect(getMaterialPreviewData(input)).resolves.toEqual(preview);
    expect(connectionMock).toHaveBeenCalledOnce();
    expect(previewMock).toHaveBeenCalledWith(input);
  });

  it("keeps the existing cached Convex material read for route data", async () => {
    const page = {
      body: previewWireMdx,
      contentHash: "runtime-hash",
      metadata: {
        ...previewMetadata,
        authors: previewMetadata.authors.map(({ name }) => ({ name })),
        description: previewMetadata.description,
        subject: previewMetadata.subject,
      },
      section: previewProjection.sectionKey,
      slug: previewProjection.contentKey,
      syncedAt: 1,
      topic: "function-composition-inverse-function",
    };
    runtimeMock.mockResolvedValue(page);

    await expect(
      getMaterialPageData({
        locale: "en",
        sourcePath: previewProjection.contentKey,
      })
    ).resolves.toEqual(page);
    expect(cacheMock).toHaveBeenCalledOnce();
    expect(runtimeMock).toHaveBeenCalledWith({
      locale: "en",
      slug: previewProjection.contentKey,
    });
  });

  it("caches the active publication ownership decision", async () => {
    const route = Option.none();
    routeMock.mockReturnValue(Effect.succeed(route));

    await expect(
      getMaterialRouteData({
        params: input.params,
        target: input.target,
      })
    ).resolves.toEqual(route);
    expect(cacheMock).toHaveBeenCalledOnce();
    expect(routeMock).toHaveBeenCalledWith(input.params, input.target);
  });

  it("surfaces a missing runtime projection as an operational failure", async () => {
    runtimeMock.mockResolvedValue(null);

    await expect(
      getMaterialPageData({ locale: "en", sourcePath: "material/source" })
    ).rejects.toThrow('"sourcePath": "material/source"');
    expect(cacheMock).toHaveBeenCalledOnce();
    expect(runtimeMock).toHaveBeenCalledWith({
      locale: "en",
      slug: "material/source",
    });
  });
});
