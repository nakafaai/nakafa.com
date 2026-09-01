// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import { readPublishedMarkdown } from "@repo/backend/client/nakafa/published";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { TEST_ARTICLE_PROJECTION } from "@repo/backend/test/content/runtime";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import { Effect, Option } from "effect";

const readMock = vi.hoisted(() => vi.fn());
const material = makeMaterialProjection("en", 1);
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-token",
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContentEvidence: readMock,
}));

beforeEach(() => {
  readMock.mockReset();
});

describe("Nakafa signed public reader", () => {
  it.effect.each([
    ["articles" as const, TEST_ARTICLE_PROJECTION],
    ["material" as const, material],
  ] as const)("reads verified %s raw MDX", ([section, projection]) =>
    Effect.gen(function* () {
      const ref = currentRef(section, projection);
      readMock.mockReturnValue(
        Effect.succeed({
          activeReleaseId: "release-example",
          artifact: {
            payload: {
              rawMdx:
                'export const metadata = { title: "Ignored" }\n\n## Current body',
            },
          },
          delivery: "public",
          projection,
        })
      );

      const result = yield* readPublishedMarkdown(() => target, ref);

      expect(readMock).toHaveBeenCalledWith(target, {
        appLocale: projection.appLocale,
        publicPath: projection.publicPath,
      });
      if (Option.isNone(result)) {
        expect.fail("Expected signed public markdown.");
      }
      expect(result.value).toMatchObject({
        content_id: projection.graph.assetId,
        text: `# ${projection.metadata.title}\n\n## Current body`,
        title: projection.metadata.title,
      });
      if (section === "material") {
        expect(result.value).not.toHaveProperty("description");
      }
    })
  );

  it.effect.each([
    [
      "configuration",
      () => {
        throw new Error("missing token");
      },
      Effect.succeed({ projection: material }),
    ],
    [
      "runtime",
      () => target,
      Effect.fail(new ContentTransportError({ reason: "fetch" })),
    ],
    [
      "family",
      () => target,
      Effect.succeed({
        artifact: { payload: { rawMdx: "## Body" } },
        projection: { ...material, kind: "article" },
      }),
    ],
    [
      "identity",
      () => target,
      Effect.succeed({
        artifact: { payload: { rawMdx: "## Body" } },
        projection: {
          ...material,
          graph: { ...material.graph, assetId: "invalid" },
        },
      }),
    ],
    [
      "markdown",
      () => target,
      Effect.succeed({
        artifact: { payload: { rawMdx: "<" } },
        projection: material,
      }),
    ],
  ] as const)(
    "maps %s failures into one agent read error",
    ([_kind, reader, read]) =>
      Effect.gen(function* () {
        readMock.mockReturnValue(read);

        expect(
          yield* readPublishedMarkdown(
            reader,
            currentRef("material", material)
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "NakafaAgentDataReadError",
          message: "Unable to read signed Nakafa public content.",
        });
      })
  );
});

/** Builds one schema-decoded public reference for a signed projection. */
function currentRef(
  section: "articles" | "material",
  projection: typeof TEST_ARTICLE_PROJECTION | typeof material
) {
  const ref = createNakafaContentRefFromGraphProjection({
    ...projection.graph,
    content_id: projection.graph.assetId,
    locale: projection.appLocale,
    route: projection.publicPath,
    section,
  });
  if (Option.isNone(ref)) {
    throw new Error("Expected one valid signed public reference.");
  }
  return { ...ref.value, section };
}
