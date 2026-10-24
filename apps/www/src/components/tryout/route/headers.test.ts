import { describe, expect, it } from "@effect/vitest";
import {
  readTryoutCatalogHeaders,
  readTryoutPersonalHeaders,
} from "@/components/tryout/route/headers";

describe("try-out response headers", () => {
  it("caches a public catalog page at the CDN for an hour", () => {
    expect(readTryoutCatalogHeaders()["Cache-Control"]).toContain(
      "s-maxage=3600"
    );
  });

  it("never stores a page that holds one learner's progress", () => {
    expect(readTryoutPersonalHeaders()).toEqual({
      "Cache-Control": "private, no-store",
    });
  });
});
