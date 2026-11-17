// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readRenamedExamRedirect } from "@/lib/routing/public/tryout/renamed";
import { serveTryoutCatalog } from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/routing/public/tryout/map.server", () => ({
  readMappedLocalizedPath: mocks.path,
  /** Reads whether the catalog serves one path in its own locale, through the localized-path mock. */
  readActiveTryoutPath: (appLocale: string, publicPath: string) =>
    mocks.path({
      currentAppLocale: appLocale,
      publicPath,
      targetAppLocale: appLocale,
    }),
}));

const TABLE =
  "try-out/germany/aufnahmepruefung/tu-darmstadt-studienkolleg/mathematics";

beforeEach(() => {
  vi.clearAllMocks();
  serveTryoutCatalog(mocks, {
    routes: [
      { en: "try-out/germany/aufnahmepruefung" },
      { en: TABLE },
      { id: "try-out/jerman/aufnahmepruefung" },
    ],
  });
});

describe("exam addresses retired by the official names", () => {
  it.effect(
    "moves a page under a retired exam address to the same page under the exam's name, for good",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readRenamedExamRedirect(
            "/en/try-out/germany/entrance-examination/tu-darmstadt-studienkolleg/mathematics"
          )
        ).toEqual({ destination: `/en/${TABLE}`, status: 308 });
        expect(
          yield* readRenamedExamRedirect("/id/try-out/jerman/ujian-masuk")
        ).toEqual({
          destination: "/id/try-out/jerman/aufnahmepruefung",
          status: 308,
        });
      })
  );

  it.effect(
    "leaves a path alone that names no retired exam of its locale, or whose successor is not live",
    () =>
      Effect.gen(function* () {
        for (const pathname of [
          "/en",
          "/fr/try-out/germany/entrance-examination",
          "/en/articles/germany/entrance-examination",
          "/en/try-out/germany/aufnahmepruefung",
          "/id/try-out/germany/entrance-examination",
          "/en/try-out/germany/entrance-examination/somewhere-else",
        ]) {
          expect(yield* readRenamedExamRedirect(pathname)).toBeNull();
        }
      })
  );
});
