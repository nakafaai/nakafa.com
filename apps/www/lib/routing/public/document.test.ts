// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { vi } from "vitest";
import { resolvePublicDocumentRoute } from "@/lib/routing/public/document";

const routeMocks = vi.hoisted(() => ({
  markdown: vi.fn(),
  projected: vi.fn(),
  source: vi.fn(),
}));

vi.mock("@/lib/llms/content/markdown", () => ({
  hasLlmsMarkdownSource: routeMocks.markdown,
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
  isRscRequest: false,
  method: "GET",
  pathname: "/en/search",
};

describe("public document route resolution", () => {
  beforeEach(() => {
    routeMocks.markdown.mockReset().mockReturnValue(Effect.succeed(false));
    routeMocks.source.mockReset().mockReturnValue(Effect.succeed(null));
    routeMocks.projected.mockReset().mockReturnValue(Effect.succeed(null));
  });

  it.effect.each(["application/json", "text/markdown"])(
    "preserves a source-backed 404 before negotiating %s",
    (accept) =>
      Effect.gen(function* () {
        routeMocks.source.mockReturnValueOnce(Effect.succeed("id"));

        expect(
          yield* resolvePublicDocumentRoute({
            ...defaultInput,
            acceptHeader: Option.some(accept),
            pathname: "/id/quran/999",
          })
        ).toEqual({ kind: "not-found", locale: "id" });
        expect(routeMocks.markdown).not.toHaveBeenCalled();
        expect(routeMocks.projected).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves an owned Markdown rewrite before projected ownership",
    () =>
      Effect.gen(function* () {
        routeMocks.markdown.mockReturnValueOnce(Effect.succeed(true));

        expect(
          yield* resolvePublicDocumentRoute({
            ...defaultInput,
            acceptHeader: Option.some("text/markdown"),
            pathname: "/en/curriculum/example",
          })
        ).toEqual({
          kind: "rewrite-markdown",
          localizedRoute: {
            locale: "en",
            markdownExtension: "",
            route: "/curriculum/example",
          },
        });
        expect(routeMocks.projected).not.toHaveBeenCalled();
      })
  );

  it.effect("preserves a projected 404 before a terminal 406", () =>
    Effect.gen(function* () {
      routeMocks.projected.mockReturnValueOnce(Effect.succeed("en"));

      expect(
        yield* resolvePublicDocumentRoute({
          ...defaultInput,
          acceptHeader: Option.some("application/json"),
          hasAttemptCapability: true,
          pathname: "/en/curriculum/missing",
        })
      ).toEqual({ kind: "not-found", locale: "en" });
      expect(routeMocks.projected).toHaveBeenCalledWith({
        hasAttemptCapability: true,
        pathname: "/en/curriculum/missing",
      });
    })
  );

  it.effect("returns the final delegate decision", () =>
    Effect.gen(function* () {
      expect(yield* resolvePublicDocumentRoute(defaultInput)).toEqual({
        kind: "delegate",
      });
    })
  );

  it.effect("returns the final not-acceptable decision", () =>
    Effect.gen(function* () {
      expect(
        yield* resolvePublicDocumentRoute({
          ...defaultInput,
          acceptHeader: Option.some("application/json"),
        })
      ).toEqual({ kind: "not-acceptable" });
    })
  );
});
