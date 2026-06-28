// @vitest-environment node
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";

describe("public url migration redirects", () => {
  it("redirects previous Indonesian material lesson URLs to canonical material paths", async () => {
    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "GET",
          pathname:
            "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
        })
      )
    ).resolves.toBe(
      "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling"
    );
  });

  it("redirects previous English material lesson URLs to canonical subject paths", async () => {
    await expect(
      Effect.runPromise(
        readPublicUrlMigrationRedirect({
          method: "HEAD",
          pathname:
            "/en/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
        })
      )
    ).resolves.toBe(
      "/en/subjects/mathematics/circle/central-angle-and-inscribed-angle"
    );
  });

  it("delegates current, non-read, and unknown previous paths", async () => {
    const paths = [
      {
        expected: null,
        method: "GET",
        pathname:
          "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling",
      },
      {
        expected: null,
        method: "POST",
        pathname:
          "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      },
      {
        expected: null,
        method: "GET",
        pathname: "/id/subject/high-school/11/mathematics",
      },
      {
        expected: null,
        method: "GET",
        pathname: "/id/subject/high-school/11/mathematics/circle",
      },
      {
        expected: null,
        method: "GET",
        pathname:
          "/fr/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle",
      },
      {
        expected: null,
        method: "GET",
        pathname: "/id/subject/high-school/11/mathematics/not-a-real-topic",
      },
    ];

    for (const path of paths) {
      await expect(
        Effect.runPromise(readPublicUrlMigrationRedirect(path))
      ).resolves.toBe(path.expected);
    }
  });
});
