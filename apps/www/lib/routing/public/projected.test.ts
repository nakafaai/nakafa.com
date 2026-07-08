// @vitest-environment node
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";

describe("projected public html route rejection", () => {
  it("rejects projected app routes that cannot render HTML", async () => {
    const paths = [
      ["/en/subjects/mathematics/integral/invalid.segment", "en"],
      ["/en/subjects/chemistry/green-chemistry", "en"],
      ["/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a", "en"],
      [
        "/en/curriculum/merdeka/class-10/mathematics-afdocs-nonexistent-8f3a",
        "en",
      ],
      ["/id/try-out/snbt/tryout-2026", "id"],
      ["/id/try-out/snbt/tryout-2026/part/penalaran-umum", "id"],
      ["/en/try-out/indonesia/snbt/set-1/not-a-section", "en"],
    ];

    for (const [pathname, locale] of paths) {
      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe(locale);
    }
  });

  it("delegates projected app routes that render HTML", async () => {
    const paths = [
      "/en/subjects/chemistry/green-chemistry/definition",
      "/en/curriculum",
      "/id/kurikulum",
      "/id/kurikulum/merdeka/kelas-10/biologi",
      "/en/curriculum/merdeka/class-10",
      "/id/try-out",
      "/en/try-out/indonesia",
      "/id/try-out/indonesia/snbt/set-1/penalaran-umum",
      "/en/try-out/indonesia/snbt/set-1/general-reasoning",
    ];

    for (const pathname of paths) {
      await expect(
        Effect.runPromise(readProjectedHtmlRouteRejection(pathname))
      ).resolves.toBe(null);
    }
  });
});
