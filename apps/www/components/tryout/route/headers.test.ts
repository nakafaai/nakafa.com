import { describe, expect, it } from "@effect/vitest";
import {
  readTryoutCatalogHeaders,
  readTryoutPersonalHeaders,
} from "@/components/tryout/route/headers";

describe("try-out response headers", () => {
  it("caches a public catalog page at the CDN under the try-out release tag", () => {
    const headers = readTryoutCatalogHeaders();

    expect(headers["Cache-Control"]).toContain("s-maxage=3600");
    expect(headers["Vercel-Cache-Tag"]).toContain("content-scope:tryout");
  });

  it("never stores a page that holds one learner's progress", () => {
    expect(readTryoutPersonalHeaders()).toEqual({
      "Cache-Control": "private, no-store",
    });
  });
});
