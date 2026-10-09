// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";

const readLocalizedPathMock = vi.hoisted(() => vi.fn());
const readExamPageMock = vi.hoisted(() => vi.fn());
const readSectionPageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: readLocalizedPathMock,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: readExamPageMock,
  readPublishedTryoutSectionPage: readSectionPageMock,
}));

describe("retired try-out redirects", () => {
  beforeEach(() => {
    readLocalizedPathMock.mockReset();
    readExamPageMock.mockReset();
    readSectionPageMock.mockReset();
  });

  it.effect.each([
    "/id/try-out/indonesia/tka/bahasa-inggris/set-1",
    "/id/try-out/indonesia/snbt/2027/set-1/penalaran-umum",
    "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris/extra",
    "/fr/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
    "/en/articles/politics/bahasa-inggris",
    "/id",
    "/en/try-out/indonesia/snbt",
    "/en/try-out/indonesia/snbt/2027",
    "/en/try-out/indonesia/snbt/2027/set-1",
    "/en/try-out/indonesia/tka/matematika-wajib/set-1",
    "/en/try-out/snbt/2027-set-1/extra",
    "/fr/try-out/snbt",
  ])("leaves %s alone without reading the catalog", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readTryoutRedirect(pathname)).toBeNull();
      expect(readLocalizedPathMock).not.toHaveBeenCalled();
      expect(readExamPageMock).not.toHaveBeenCalled();
      expect(readSectionPageMock).not.toHaveBeenCalled();
    })
  );
});
