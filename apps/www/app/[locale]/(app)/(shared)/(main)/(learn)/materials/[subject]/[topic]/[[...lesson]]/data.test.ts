// @vitest-environment node

import { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listMaterialStaticParams,
  readMaterialRequest,
  readMaterialRoute,
  requireParentMaterialRoute,
  resolveMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import {
  makePreviewPublicRoute,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
  previewPublicRoute,
} from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  getPublishedMaterialRoutes: vi.fn(),
  notFound: vi.fn(),
  readNamespaceSegment: vi.fn(),
  readStaticPublicContentRoutes: vi.fn(),
  resolveRouteByPath: vi.fn(),
  selectLearningStaticParams: vi.fn(),
}));

vi.mock("@repo/contents/_types/route/content/static", () => ({
  readStaticPublicContentRoutes: mocks.readStaticPublicContentRoutes,
}));
vi.mock("@repo/contents/_types/route/learning/static", () => ({
  readStaticPublicLearningIndex: () => ({
    resolveRouteByPath: mocks.resolveRouteByPath,
  }),
}));
vi.mock("@repo/contents/_types/route/path", () => ({
  readNamespaceSegment: mocks.readNamespaceSegment,
}));
vi.mock("@/lib/content/material/catalog", () => ({
  getPublishedMaterialRoutes: mocks.getPublishedMaterialRoutes,
}));
vi.mock("@/lib/routing/prerender", () => ({
  selectLearningStaticParams: mocks.selectLearningStaticParams,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

const routeParams = {
  lesson: ["function-concept"],
  locale: "en",
  subject: "mathematics",
  topic: "function-composition-inverse-function",
};
const parentRoute = Schema.decodeUnknownSync(PublicContentRouteSchema)({
  ...previewPublicRoute,
  kind: "subject-topic",
  publicPath: previewProjection.parentPath,
  title: previewProjection.topicTitle,
});

const idRoute = makePreviewPublicRoute(previewIdProjection);
const nextRoute = makePreviewPublicRoute(previewNextProjection);

/** Produces fresh framework params for one real material route. */
function params(overrides?: Partial<typeof routeParams>) {
  return Promise.resolve({ ...routeParams, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readStaticPublicContentRoutes.mockReturnValue([
    parentRoute,
    previewPublicRoute,
    idRoute,
    nextRoute,
  ]);
  mocks.readNamespaceSegment.mockReturnValue("subjects");
  mocks.resolveRouteByPath.mockReturnValue(previewPublicRoute);
  mocks.getPublishedMaterialRoutes.mockResolvedValue({
    managed: false,
    routes: [],
    sourceRevision: null,
  });
  mocks.selectLearningStaticParams.mockImplementation((values) => values);
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

describe("material route data", () => {
  it("builds and resolves one exact localized material request", async () => {
    await expect(readMaterialRequest(params())).resolves.toEqual({
      locale: "en",
      publicPath: previewProjection.publicPath,
    });
    await expect(readMaterialRoute(params())).resolves.toEqual({
      locale: "en",
      route: previewPublicRoute,
    });
    await expect(resolveMaterialRoute(params())).resolves.toEqual({
      locale: "en",
      route: previewPublicRoute,
    });
    await expect(
      readMaterialRequest(
        Promise.resolve({
          locale: "en",
          subject: routeParams.subject,
          topic: routeParams.topic,
        })
      )
    ).resolves.toEqual({
      locale: "en",
      publicPath: "subjects/mathematics/function-composition-inverse-function",
    });
  });

  it("returns no route when the locale has no material namespace", async () => {
    mocks.readNamespaceSegment
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await expect(readMaterialRequest(params())).resolves.toEqual({
      locale: "en",
      publicPath: undefined,
    });
    await expect(readMaterialRoute(params())).resolves.toEqual({
      locale: "en",
      route: undefined,
    });
  });

  it("returns no route for an unsupported projected row", async () => {
    mocks.resolveRouteByPath.mockReturnValue({
      ...previewPublicRoute,
      kind: "article-category",
    });
    await expect(readMaterialRoute(params())).resolves.toEqual({
      locale: "en",
      route: undefined,
    });
    await expect(resolveMaterialRoute(params())).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("lists static params from the exclusive published owner", async () => {
    mocks.getPublishedMaterialRoutes.mockResolvedValue({
      managed: true,
      routes: [previewProjection],
      sourceRevision: "a".repeat(40),
    });

    await expect(listMaterialStaticParams("en")).resolves.toEqual([
      {
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
    ]);
    expect(mocks.readStaticPublicContentRoutes).not.toHaveBeenCalled();
  });

  it("uses the source catalog only while material is unmanaged", async () => {
    await expect(listMaterialStaticParams("en")).resolves.toEqual([
      {
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
      {
        lesson: ["injective-surjective-bijective-function"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
    ]);
  });

  it("lists every source locale only when no locale is requested", async () => {
    await expect(listMaterialStaticParams()).resolves.toEqual([
      {
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
      {
        lesson: ["konsep-fungsi"],
        subject: "matematika",
        topic: "fungsi-komposisi-dan-fungsi-invers",
      },
      {
        lesson: ["injective-surjective-bijective-function"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
    ]);
    expect(mocks.getPublishedMaterialRoutes).not.toHaveBeenCalled();
  });

  it("requires the source topic parent only during the unmanaged path", () => {
    expect(requireParentMaterialRoute(previewPublicRoute)).toMatchObject({
      title: previewProjection.topicTitle,
    });
    expect(() => requireParentMaterialRoute(parentRoute)).toThrow(
      "NEXT_NOT_FOUND"
    );
  });
});
