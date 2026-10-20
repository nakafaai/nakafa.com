// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { Array as Arr, Effect, Option } from "effect";
import { buildRootLlmsIndexText } from "@/lib/llms/index/public";
import {
  answerLlmsMarkdown,
  readLlmsMarkdownTarget,
} from "@/lib/llms/markdown.server";

const getLlmsMarkdownTextMock = vi.hoisted(() => vi.fn());
const getLlmsSectionIndexTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content/markdown", () => ({
  /** Controls which route has a page source. */
  getLlmsMarkdownText: getLlmsMarkdownTextMock,
}));

vi.mock("@/lib/llms/index/generate", () => ({
  /** Controls which route has a section index. */
  getLlmsSectionIndexText: getLlmsSectionIndexTextMock,
}));

const VARY = "Accept, Accept-Encoding";

/** Reads the body of one answer. */
const bodyOf = (response: Response) => Effect.promise(() => response.text());

beforeEach(() => {
  getLlmsMarkdownTextMock.mockReset().mockReturnValue(Effect.succeed(null));
  getLlmsSectionIndexTextMock.mockReset().mockReturnValue(Effect.succeed(null));
});

describe("llms markdown target", () => {
  it("reads the locale and route of a prefixed path without its extension", () => {
    expect(readLlmsMarkdownTarget(["id", "articles", "belajar.md"])).toEqual({
      cleanSlug: "articles/belajar",
      hasLocalePrefix: true,
      locale: "id",
    });
  });

  it("answers for the default locale when the path has no supported locale", () => {
    expect(readLlmsMarkdownTarget(["articles", "belajar"])).toEqual({
      cleanSlug: "articles/belajar",
      hasLocalePrefix: false,
      locale: "en",
    });
  });
});

describe("llms markdown answer", () => {
  it.effect("answers the root index for the llms route", () =>
    Effect.gen(function* () {
      const response = yield* answerLlmsMarkdown({
        cleanSlug: "llms",
        hasLocalePrefix: false,
        locale: "en",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/markdown; charset=utf-8"
      );
      expect(response.headers.get("vary")).toBe(VARY);
      expect(yield* bodyOf(response)).toBe(buildRootLlmsIndexText());
    })
  );

  it.effect("answers the locale index of a localized root", () =>
    Effect.gen(function* () {
      getLlmsSectionIndexTextMock.mockReturnValue(
        Effect.succeed("# Locale index")
      );

      const response = yield* answerLlmsMarkdown({
        cleanSlug: "",
        hasLocalePrefix: true,
        locale: "en",
      });

      expect(yield* bodyOf(response)).toBe("# Locale index");
      expect(getLlmsSectionIndexTextMock).toHaveBeenCalledWith("llms/en");
    })
  );

  it.effect("answers an application section index without a page source", () =>
    Effect.gen(function* () {
      const appSurface = Option.getOrThrow(
        Arr.findFirst(
          PUBLIC_ROUTE_SURFACES,
          (surface) => surface.key !== "subject" && surface.key !== "curriculum"
        )
      );

      const response = yield* answerLlmsMarkdown({
        cleanSlug: `${appSurface.routeSlugs.en}/llms.txt`,
        hasLocalePrefix: true,
        locale: "en",
      });

      expect(response.status).toBe(200);
      expect(yield* bodyOf(response)).toContain("learner-facing");
      expect(getLlmsMarkdownTextMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "answers the section index of a public section with its own index",
    () =>
      Effect.gen(function* () {
        getLlmsSectionIndexTextMock.mockReturnValue(
          Effect.succeed("# Quran index")
        );

        const response = yield* answerLlmsMarkdown({
          cleanSlug: "quran/llms.txt",
          hasLocalePrefix: true,
          locale: "en",
        });

        expect(yield* bodyOf(response)).toBe("# Quran index");
        expect(getLlmsSectionIndexTextMock).toHaveBeenCalledWith(
          "llms/en/quran"
        );
      })
  );

  it.effect("answers a page source with its markdown", () =>
    Effect.gen(function* () {
      getLlmsMarkdownTextMock.mockReturnValue(
        Effect.succeed("# Article title")
      );

      const response = yield* answerLlmsMarkdown({
        cleanSlug: "articles/belajar",
        hasLocalePrefix: true,
        locale: "en",
      });

      expect(response.status).toBe(200);
      expect(yield* bodyOf(response)).toBe("# Article title");
      expect(response.headers.get("vary")).toBe(VARY);
    })
  );

  it.effect("tags every Markdown answer for the purge of the corpus", () =>
    Effect.gen(function* () {
      getLlmsMarkdownTextMock.mockReturnValue(
        Effect.succeed("# Article title")
      );

      const root = yield* answerLlmsMarkdown({
        cleanSlug: "llms",
        hasLocalePrefix: false,
        locale: "en",
      });
      const page = yield* answerLlmsMarkdown({
        cleanSlug: "articles/belajar",
        hasLocalePrefix: true,
        locale: "en",
      });
      const missing = yield* answerLlmsMarkdown({
        cleanSlug: "articles/unknown",
        hasLocalePrefix: true,
        locale: "en",
      });

      for (const response of [root, page, missing]) {
        expect(response.headers.get("vercel-cache-tag")).toBe("content-llms");
      }
    })
  );

  it.effect("answers a plain not found when a locale index names no body", () =>
    Effect.gen(function* () {
      const response = yield* answerLlmsMarkdown({
        cleanSlug: "",
        hasLocalePrefix: true,
        locale: "en",
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      expect(yield* bodyOf(response)).toBe("Not found");
    })
  );

  it.effect("answers the section index of a route with an index", () =>
    Effect.gen(function* () {
      getLlmsSectionIndexTextMock.mockImplementation((slug: string) =>
        Effect.succeed(slug === "articles" ? "# Articles" : null)
      );

      const response = yield* answerLlmsMarkdown({
        cleanSlug: "articles",
        hasLocalePrefix: false,
        locale: "en",
      });

      expect(yield* bodyOf(response)).toBe("# Articles");
    })
  );

  it.effect("answers a missing llms index as plain not found", () =>
    Effect.gen(function* () {
      const response = yield* answerLlmsMarkdown({
        cleanSlug: "llms/en/missing",
        hasLocalePrefix: false,
        locale: "en",
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      expect(yield* bodyOf(response)).toBe("Not found");
    })
  );

  it.effect(
    "answers a known route without source as markdown not found with discovery headers",
    () =>
      Effect.gen(function* () {
        const response = yield* answerLlmsMarkdown({
          cleanSlug: "articles/unknown",
          hasLocalePrefix: true,
          locale: "en",
        });

        expect(response.status).toBe(404);
        expect(response.headers.get("x-robots-tag")).toBe("noindex");
        expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
        expect(response.headers.get("link")).toBe(
          '</llms.txt>; rel="llms-txt"'
        );
        expect(response.headers.get("content-type")).toBe(
          "text/markdown; charset=utf-8"
        );
        expect(yield* bodyOf(response)).toContain("/articles/unknown");
      })
  );
});
