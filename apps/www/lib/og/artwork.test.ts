// @vitest-environment node

import { describe, expect, it } from "vitest";
import { hasStaticArtwork, resolveSocialArtwork } from "@/lib/og/artwork";

describe("localized social artwork", () => {
  it("uses complete reviewed English and Indonesian static artwork", () => {
    expect(hasStaticArtwork("en")).toBe(true);
    expect(hasStaticArtwork("id")).toBe(true);
    expect(
      resolveSocialArtwork({
        locale: "id",
        publicPath: "kurikulum/merdeka",
        reviewedPath: "/open-graph/curriculum/id-merdeka.png",
      })
    ).toBe("/open-graph/curriculum/id-merdeka.png");
  });

  it("uses localized dynamic artwork for German and future locales", () => {
    expect(hasStaticArtwork("de")).toBe(false);
    expect(
      resolveSocialArtwork({
        locale: "de",
        publicPath: "lehrplaene/merdeka",
        reviewedPath: "/open-graph/curriculum/de-merdeka.png",
      })
    ).toBe("/de/og/lehrplaene/merdeka/image.png");
  });
});
