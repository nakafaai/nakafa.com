import { readNakafaMarkdown } from "@repo/backend/client/nakafa/markdown";
import {
  makeMaterialContentRef,
  makeMaterialProjection,
} from "@repo/backend/test/content-material";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  readPublishedMaterialMarkdown: vi.fn(),
  resolveNakafaContentRef: vi.fn(),
}));

vi.mock("@repo/backend/client/nakafa/material", () => ({
  readPublishedMaterialMarkdown: runtimeMocks.readPublishedMaterialMarkdown,
}));
vi.mock("@repo/backend/client/nakafa/ref", () => ({
  resolveNakafaContentRef: runtimeMocks.resolveNakafaContentRef,
}));

const materialRef = makeMaterialContentRef(makeMaterialProjection("en", 1));

beforeEach(() => {
  runtimeMocks.readPublishedMaterialMarkdown.mockReset();
  runtimeMocks.resolveNakafaContentRef.mockReset();
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
});
