// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { getAppSocialArtwork } from "@/lib/og/app";
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

  it.effect("keeps the manifest and filesystem in exact agreement", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const artworkRoot = path.join(process.cwd(), "public", "open-graph");
      const manifestPaths = listStaticArtworkPaths();
      const entries = yield* fs.readDirectory(artworkRoot, { recursive: true });
      const filesystemPaths = entries.filter((entry) => entry.endsWith(".png"));
      const publicFilesystemPaths = filesystemPaths.map(
        (entry) => `/open-graph/${entry}`
      );

      expect(manifestPaths).toHaveLength(101);
      expect(new Set(manifestPaths).size).toBe(101);
      expect([...publicFilesystemPaths].sort()).toEqual(
        [...manifestPaths].sort()
      );
      expect(publicFilesystemPaths).not.toContain(
        "/open-graph/tryout/indonesia/en-2026.png"
      );

      for (const entry of filesystemPaths) {
        expect(path.basename(entry)).toMatch(ARTWORK_FILENAME_PATTERN);

        const image = yield* fs.readFile(path.join(artworkRoot, entry));
        const header = new DataView(
          image.buffer,
          image.byteOffset,
          image.byteLength
        );
        expect(new TextDecoder("ascii").decode(image.subarray(1, 4))).toBe(
          "PNG"
        );
        expect(header.getUint32(16)).toBe(1200);
        expect(header.getUint32(20)).toBe(630);
      }
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
