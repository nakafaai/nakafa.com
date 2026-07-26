// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPublishedMaterialPath,
  readPublishedNinaMaterial,
} from "@/app/api/chat/published";
import { previewProjection, previewSourcePath } from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  materialContext: vi.fn(),
  materialRoute: vi.fn(),
}));

vi.mock("@/lib/content/material/context", () => ({
  readPublishedMaterialContext: mocks.materialContext,
}));
vi.mock("@/lib/content/material/route", () => ({
  readPublishedMaterialRoute: mocks.materialRoute,
}));

const input = {
  contextHint: "merdeka~class-11-mathematics",
  locale: "en",
  publicPath: previewProjection.publicPath,
  url: `https://nakafa.com/en/${previewProjection.publicPath}`,
} as const;
const publishedMaterial = {
  managed: true,
  projection: previewProjection,
  sourcePath: previewSourcePath,
};

beforeEach(() => {
  mocks.materialContext.mockReset();
  mocks.materialRoute.mockReset();
  mocks.materialRoute.mockReturnValue(Effect.succeed(publishedMaterial));
});

describe("published Nina material", () => {
  it("recognizes only localized material namespaces", () => {
    expect(isPublishedMaterialPath("en", previewProjection.publicPath)).toBe(
      true
    );
    expect(
      isPublishedMaterialPath(
        "id",
        "materi/matematika/fungsi-komposisi/konsep-fungsi"
      )
    ).toBe(true);
    expect(isPublishedMaterialPath("en", "articles/mathematics")).toBe(false);
  });

  it("leaves unmanaged material to the source-backed owner", async () => {
    mocks.materialRoute.mockReturnValue(
      Effect.succeed({ managed: false, projection: null })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input))
    ).resolves.toEqual({
      learning: null,
      managed: false,
      placement: undefined,
      programManaged: false,
    });
  });

  it("fails closed when a managed route has no active projection", async () => {
    mocks.materialRoute.mockReturnValue(
      Effect.succeed({ managed: true, projection: null })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("builds verified learning without placement when no hint exists", async () => {
    const result = await Effect.runPromise(
      readPublishedNinaMaterial({ ...input, contextHint: null })
    );

    expect(result).toMatchObject({
      learning: {
        assetId: previewProjection.graph.assetId,
        contentId: previewProjection.graph.assetId,
        materialKey: previewProjection.materialKey,
        sourcePath: previewSourcePath,
        title: previewProjection.metadata.title,
        verified: true,
      },
      managed: true,
      placement: undefined,
      programManaged: false,
    });
    expect(mocks.materialContext).not.toHaveBeenCalled();
  });

  it("leaves placement to source data while the program is unmanaged", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({ managed: false, value: null })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input))
    ).resolves.toMatchObject({
      managed: true,
      placement: undefined,
      programManaged: false,
    });
  });

  it("drops stale placement after the program owner activates", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({ managed: true, value: null })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input))
    ).resolves.toMatchObject({
      managed: true,
      placement: undefined,
      programManaged: true,
    });
  });

  it("rejects an invalid published program identity", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({
        managed: true,
        value: {
          context: {
            nodeKey: "class-11-mathematics",
            programKey: 42,
          },
          href: "/en/curriculum/invalid",
          label: "Mathematics",
        },
      })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("uses the active program placement without static reconstruction", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({
        managed: true,
        value: {
          context: {
            nodeKey: "class-11-mathematics",
            programKey: "merdeka",
          },
          href: "/en/curriculum/merdeka/class-11/mathematics",
          label: "Mathematics",
        },
      })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input))
    ).resolves.toMatchObject({
      placement: {
        mode: "placement",
        nodeKey: "class-11-mathematics",
        parentHref: "/en/curriculum/merdeka/class-11/mathematics",
        parentTitle: "Mathematics",
        programKey: "merdeka",
      },
      programManaged: true,
    });
  });
});
