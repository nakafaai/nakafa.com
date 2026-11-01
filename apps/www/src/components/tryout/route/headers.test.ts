import { describe, expect, it } from "@effect/vitest";
import { readTryoutCatalogHeaders } from "@/components/tryout/route/headers";

describe("try-out response headers", () => {
  it("caches a public catalog page at the CDN for an hour", () => {
    expect(readTryoutCatalogHeaders()["Cache-Control"]).toContain(
      "s-maxage=3600"
    );
  });
});
