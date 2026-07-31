import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import {
  makeMaterialContentRef,
  makeMaterialProjection,
} from "@repo/backend/test/content-material";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchNakafaRuntimeQuery: vi.fn(),
  readPublishedMaterialMarkdown: vi.fn(),
  resolveNakafaContentRef: vi.fn(),
  verifyNakafaReleasePin: vi.fn(),
}));

vi.mock("@repo/backend/client/nakafa/material", () => ({
  readPublishedMaterialMarkdown: runtimeMocks.readPublishedMaterialMarkdown,
}));
vi.mock("@repo/backend/client/nakafa/ref", () => ({
  resolveNakafaContentRef: runtimeMocks.resolveNakafaContentRef,
}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  fetchNakafaRuntimeQuery: runtimeMocks.fetchNakafaRuntimeQuery,
}));
vi.mock("@repo/backend/client/nakafa/release", () => ({
  verifyNakafaReleasePin: runtimeMocks.verifyNakafaReleasePin,
}));

const materialRef = makeMaterialContentRef(makeMaterialProjection("en", 1));

beforeEach(() => {
  runtimeMocks.fetchNakafaRuntimeQuery.mockReset();
  runtimeMocks.readPublishedMaterialMarkdown.mockReset();
  runtimeMocks.resolveNakafaContentRef.mockReset();
  runtimeMocks.verifyNakafaReleasePin
    .mockReset()
    .mockReturnValue(Effect.succeed(null));
});

describe("readNakafaMarkdown", () => {
  it("preserves a stable material asset ID across the signed lookup", async () => {
    runtimeMocks.resolveNakafaContentRef.mockReturnValue(
      Effect.succeed(Option.some(materialRef))
    );
    runtimeMocks.readPublishedMaterialMarkdown.mockReturnValue(
      Effect.succeed({ managed: true, markdown: Option.none() })
    );
    const readTarget = () => ({
      siteUrl: "https://example.convex.site",
      token: "runtime-token",
    });

    await Effect.runPromise(
      readNakafaMarkdown(
        "https://example.convex.cloud",
        readTarget,
        materialRef.content_id
      )
    );

    expect(runtimeMocks.readPublishedMaterialMarkdown).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      readTarget,
      materialRef.content_id
    );
  });

  it("checks the release again after reading source material markdown", async () => {
    runtimeMocks.resolveNakafaContentRef.mockReturnValue(
      Effect.succeed(Option.some(materialRef))
    );
    runtimeMocks.readPublishedMaterialMarkdown.mockReturnValue(
      Effect.succeed({
        activeReleaseId: null,
        managed: false,
        markdown: Option.none(),
      })
    );
    runtimeMocks.fetchNakafaRuntimeQuery.mockReturnValue(
      Effect.succeed({
        body: "## Source lesson",
        metadata: { title: "Source material" },
      })
    );

    await Effect.runPromise(
      readNakafaMarkdown(
        "https://example.convex.cloud",
        () => ({
          siteUrl: "https://example.convex.site",
          token: "runtime-token",
        }),
        materialRef.content_id
      )
    );

    expect(runtimeMocks.verifyNakafaReleasePin).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      null
    );
  });
});
