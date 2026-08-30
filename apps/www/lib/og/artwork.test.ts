// @vitest-environment node

import { glob, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";
import {
  listStaticArtworkPaths,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";

const ARTWORK_FILENAME_PATTERN = /^(de|en|id)-[a-z0-9-]+\.png$/;

describe("public artwork", () => {
  it("prefers an exact locale and then the reviewed English default", () => {
    expect(resolveStaticArtwork("subject/physics", "de")).toBe(
      "/open-graph/subject/de-physics.png"
    );
    expect(resolveStaticArtwork("app/school", "de")).toBe(
      "/open-graph/app/en-school.png"
    );
  });

  it("keeps the generated gradient when an identity has no artwork", () => {
    expect(resolveStaticArtwork(undefined, "de")).toBeUndefined();
    expect(
      resolveSocialArtwork({
        identity: undefined,
        locale: "de",
        publicPath: "unbekannt",
      })
    ).toBe("/de/og/unbekannt/image.png");
  });

  it("resolves app surfaces through stable keys", () => {
    expect(
      getAppSocialArtwork({ key: "quran", locale: "de", publicPath: "quran" })
    ).toBe("/open-graph/quran/de-index.png");
    expect(
      getAppSocialArtwork({ key: "school", locale: "id", publicPath: "school" })
    ).toBe("/open-graph/app/en-school.png");
    expect(
      getAppSocialArtwork({
        key: "pricing",
        locale: "de",
        publicPath: "pricing",
      })
    ).toBe("/open-graph/app/de-pricing.png");
    expect(
      getAppSocialArtwork({ key: "home", locale: "en", publicPath: "" })
    ).toBe("/en/og/image.png");
  });

  it("keeps the manifest and filesystem in exact agreement", async () => {
    const artworkRoot = join(process.cwd(), "public", "open-graph");
    const manifestPaths = listStaticArtworkPaths();
    const filesystemPaths: string[] = [];
    for await (const path of glob("**/*.png", { cwd: artworkRoot })) {
      filesystemPaths.push(path);
    }
    const publicFilesystemPaths = filesystemPaths.map(
      (path) => `/open-graph/${path}`
    );

    expect(manifestPaths).toHaveLength(90);
    expect(new Set(manifestPaths).size).toBe(90);
    expect([...publicFilesystemPaths].sort()).toEqual(
      [...manifestPaths].sort()
    );
    expect(publicFilesystemPaths).not.toContain(
      "/open-graph/tryout/indonesia/en-2026.png"
    );

    for (const path of filesystemPaths) {
      expect(basename(path)).toMatch(ARTWORK_FILENAME_PATTERN);

      const image = await readFile(join(artworkRoot, path));
      expect(image.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(image.readUInt32BE(16)).toBe(1200);
      expect(image.readUInt32BE(20)).toBe(630);
    }
  });
});
