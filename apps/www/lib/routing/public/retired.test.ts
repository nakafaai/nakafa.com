// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { readRetiredPublicRoute } from "@/lib/routing/public/retired";

const readExamPageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: readExamPageMock,
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: vi.fn(),
}));

/** Serves the signed SNBT exam with one year track per given year, or no exam at all. */
function serveSnbtExam(years: readonly string[] | null) {
  readExamPageMock.mockReturnValue(
    Effect.succeed(
      years === null
        ? null
        : {
            tracks: Arr.map(years, (year) => ({
              publicPath: `try-out/indonesia/snbt/${year}`,
              trackKey: year,
              trackKind: "year",
            })),
          }
    )
  );
}

describe("removed public routes", () => {
  beforeEach(() => {
    readExamPageMock.mockReset();
  });

  it.effect.each([
    "/en/event/try-out/ABC123",
    "/en/events",
    "/id/events",
    "/de/finance",
    "/en/finance/chat/chat-1",
    "/api/chat/finance",
    "/sitemap-domain.xml",
  ])("answers %s gone without a successor", (pathname) =>
    Effect.gen(function* () {
      expect(
        yield* readRetiredPublicRoute({ hasAttemptCapability: false, pathname })
      ).toBe(true);
      expect(readExamPageMock).not.toHaveBeenCalled();
    })
  );

  it.effect.each([
    "/sitemap/article_en_abc.xml",
    "/en/events/archive",
    "/fr/events",
    "/en/finance/chat",
    "/en/event/try-out",
    "/en/subjects/mathematics",
  ])("keeps %s on its current answer", (pathname) =>
    Effect.gen(function* () {
      expect(
        yield* readRetiredPublicRoute({ hasAttemptCapability: false, pathname })
      ).toBe(false);
      expect(readExamPageMock).not.toHaveBeenCalled();
    })
  );
});

describe("retired SNBT product URLs", () => {
  beforeEach(() => {
    readExamPageMock.mockReset();
  });

  it.effect.each([
    "/en/try-out/snbt/2026-set-1",
    "/en/try-out/snbt/2026-set-1/part/english-language",
    "/de/try-out/snbt/2026-set-1",
  ])("answers %s gone when the SNBT exam has no 2026 track", (pathname) =>
    Effect.gen(function* () {
      serveSnbtExam(["2027"]);

      expect(
        yield* readRetiredPublicRoute({ hasAttemptCapability: false, pathname })
      ).toBe(true);
      expect(readExamPageMock).toHaveBeenCalledWith({
        appLocale: "en",
        publicPath: "try-out/indonesia/snbt",
      });
    })
  );

  it.effect("keeps a 2027 product URL on its redirect or the 404", () =>
    Effect.gen(function* () {
      serveSnbtExam(["2026", "2027"]);

      expect(
        yield* readRetiredPublicRoute({
          hasAttemptCapability: false,
          pathname: "/en/try-out/snbt/2027-set-1",
        })
      ).toBe(false);
    })
  );

  it.effect(
    "keeps a 2026 product URL on the try-out rules for an attempt",
    () =>
      Effect.gen(function* () {
        serveSnbtExam(["2027"]);

        expect(
          yield* readRetiredPublicRoute({
            hasAttemptCapability: true,
            pathname: "/en/try-out/snbt/2026-set-1",
          })
        ).toBe(false);
        expect(readExamPageMock).not.toHaveBeenCalled();
      })
  );

  it.effect("keeps a 2026 product URL when the SNBT exam is not live", () =>
    Effect.gen(function* () {
      serveSnbtExam(null);

      expect(
        yield* readRetiredPublicRoute({
          hasAttemptCapability: false,
          pathname: "/en/try-out/snbt/2026-set-1",
        })
      ).toBe(false);
    })
  );

  it.effect(
    "keeps a malformed product URL on the 404 without a catalog read",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readRetiredPublicRoute({
            hasAttemptCapability: false,
            pathname: "/en/try-out/snbt/2026-set-1/part/english-language/extra",
          })
        ).toBe(false);
        expect(readExamPageMock).not.toHaveBeenCalled();
      })
  );
});
