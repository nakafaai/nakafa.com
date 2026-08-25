// @vitest-environment node
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmsProxyRouteDecision } from "@/lib/llms/routes";
import { resolvePublicDocumentRoute } from "@/lib/routing/public/document";

const routeMocks = vi.hoisted(() => ({
  projected: vi.fn(),
  representation: vi.fn(),
  source: vi.fn(),
}));

vi.mock("@/lib/llms/routes", () => ({
  resolveLlmsProxyRoute: routeMocks.representation,
}));
vi.mock("@/lib/routing/public/projected", () => ({
  readProjectedHtmlRouteRejection: routeMocks.projected,
}));
vi.mock("@/lib/routing/public/source", () => ({
  readSourceBackedHtmlRouteRejection: routeMocks.source,
}));

const defaultInput = {
  acceptHeader: Option.some("text/html"),
  hasAttemptCapability: false,
  method: "GET",
  pathname: "/en/search",
};
const FINAL_REPRESENTATION_DECISIONS = [
  { kind: "delegate" },
  { kind: "not-acceptable" },
] satisfies readonly LlmsProxyRouteDecision[];

describe("public document route resolution", () => {
  beforeEach(() => {
    routeMocks.source.mockReset().mockReturnValue(Effect.succeed(null));
    routeMocks.representation
      .mockReset()
      .mockReturnValue(Effect.succeed({ kind: "delegate" }));
    routeMocks.projected.mockReset().mockReturnValue(Effect.succeed(null));
  });

  it.each(["application/json", "text/markdown"])(
    "preserves a source-backed 404 before negotiating %s",
    async (accept) => {
      routeMocks.source.mockReturnValueOnce(Effect.succeed("id"));

      await expect(
        Effect.runPromise(
          resolvePublicDocumentRoute({
            ...defaultInput,
            acceptHeader: Option.some(accept),
            pathname: "/id/quran/999",
          })
        )
      ).resolves.toEqual({ kind: "not-found", locale: "id" });
      expect(routeMocks.representation).not.toHaveBeenCalled();
      expect(routeMocks.projected).not.toHaveBeenCalled();
    }
  );

  it("preserves an owned Markdown rewrite before projected ownership", async () => {
    const representation = {
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: "",
        route: "/curriculum/example",
      },
    } satisfies LlmsProxyRouteDecision;
    routeMocks.representation.mockReturnValueOnce(
      Effect.succeed(representation)
    );

    await expect(
      Effect.runPromise(resolvePublicDocumentRoute(defaultInput))
    ).resolves.toEqual(representation);
    expect(routeMocks.projected).not.toHaveBeenCalled();
  });

  it("preserves a projected 404 before a terminal 406", async () => {
    routeMocks.representation.mockReturnValueOnce(
      Effect.succeed({ kind: "not-acceptable" })
    );
    routeMocks.projected.mockReturnValueOnce(Effect.succeed("en"));

    await expect(
      Effect.runPromise(
        resolvePublicDocumentRoute({
          ...defaultInput,
          hasAttemptCapability: true,
          pathname: "/en/curriculum/missing",
        })
      )
    ).resolves.toEqual({ kind: "not-found", locale: "en" });
    expect(routeMocks.projected).toHaveBeenCalledWith({
      hasAttemptCapability: true,
      pathname: "/en/curriculum/missing",
    });
  });

  it.each(FINAL_REPRESENTATION_DECISIONS)(
    "returns the final $kind representation decision",
    async (representation) => {
      routeMocks.representation.mockReturnValueOnce(
        Effect.succeed(representation)
      );

      await expect(
        Effect.runPromise(resolvePublicDocumentRoute(defaultInput))
      ).resolves.toEqual(representation);
    }
  );
});
