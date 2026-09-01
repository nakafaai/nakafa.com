// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
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

  it.effect("fails closed when the signed route is a tombstone", () =>
    Effect.gen(function* () {
      mocks.materialRoute.mockReturnValue(
        Effect.succeed({ projection: null, sourcePath: null })
      );

      const error = yield* readPublishedNinaMaterial(input).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "builds verified learning without placement when no hint exists",
    () =>
      Effect.gen(function* () {
        const result = yield* readPublishedNinaMaterial({
          ...input,
          contextHint: null,
        });

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
      })
  );

  it.effect("drops a stale signed program context", () =>
    Effect.gen(function* () {
      mocks.materialContext.mockReturnValue(Effect.succeed(null));

      const result = yield* readPublishedNinaMaterial(input);
      expect(result).toMatchObject({ placement: undefined });
    })
  );

  it.effect("rejects an invalid signed program identity", () =>
    Effect.gen(function* () {
      mocks.materialContext.mockReturnValue(
        Effect.succeed({
          context: { nodeKey: "class-11-mathematics", programKey: 42 },
          href: "/en/curriculum/invalid",
          label: "Mathematics",
        })
      );

      const error = yield* readPublishedNinaMaterial(input).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "uses the signed program placement without static reconstruction",
    () =>
      Effect.gen(function* () {
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

        const result = yield* readPublishedNinaMaterial(input);
        expect(result).toMatchObject({
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
      })
  );
});
