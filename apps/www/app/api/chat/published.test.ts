// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
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
const activeReleaseId = ReleaseIdSchema.make("material-release");
const publishedMaterial = {
  activeReleaseId,
  projection: previewProjection,
  sourcePath: previewSourcePath,
};

beforeEach(() => {
  mocks.materialContext.mockReset();
  mocks.materialRoute
    .mockReset()
    .mockReturnValue(Effect.succeed(publishedMaterial));
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
    expect(isPublishedMaterialPath("de", previewProjection.publicPath)).toBe(
      false
    );
  });

  it("fails closed when the signed route is a tombstone", async () => {
    mocks.materialRoute.mockReturnValue(
      Effect.succeed({ projection: null, sourcePath: null })
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
      placement: undefined,
    });
    expect(mocks.materialContext).not.toHaveBeenCalled();
  });

  it("drops a stale signed program context", async () => {
    mocks.materialContext.mockReturnValue(Effect.succeed(null));

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input))
    ).resolves.toMatchObject({ placement: undefined });
  });

  it("rejects an invalid signed program identity", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({
        context: { nodeKey: "class-11-mathematics", programKey: 42 },
        href: "/en/curriculum/invalid",
        label: "Mathematics",
      })
    );

    await expect(
      Effect.runPromise(readPublishedNinaMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("uses the signed program placement without static reconstruction", async () => {
    mocks.materialContext.mockReturnValue(
      Effect.succeed({
        context: {
          nodeKey: "class-11-mathematics",
          programKey: "merdeka",
        },
        href: "/en/curriculum/merdeka/class-11/mathematics",
        label: "Mathematics",
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
    });
    expect(mocks.materialContext).toHaveBeenCalledWith(
      "en",
      previewProjection,
      expect.anything(),
      activeReleaseId
    );
  });
});
