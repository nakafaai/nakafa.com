// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Order,
  Path,
  Record as Rec,
} from "effect";
import { getAppSocialArtwork } from "@/lib/og/app";
import {
  artworkSources,
  resolveCardArtwork,
  resolveSocialArtwork,
  resolveStaticArtwork,
  toCardArtwork,
} from "@/lib/og/artwork";

/** Every installed file of the inventory, once: each file a locale's readers see. */
function listStaticArtwork() {
  return Arr.dedupe(
    Arr.flatMap(Rec.keys(artworkSources), (identity) =>
      Arr.flatMap(ACTIVE_APP_LOCALE_CODES, (locale) =>
        Arr.fromNullishOr(resolveCardArtwork(identity, locale))
      )
    )
  );
}

const ARTWORK_FILENAME_PATTERN = /^(?:de|en|id|ms)-[a-z0-9-]+\.png$/u;

describe("public artwork", () => {
  it("draws a card only from a file whose lettering reads the locale's words", () => {
    expect(resolveCardArtwork("subject/physics", "ms")).toBe(
      "/open-graph/subject/ms-physics.png"
    );
    expect(resolveCardArtwork("subject/chemistry", "ms")).toBe(
      "/open-graph/subject/id-chemistry.png"
    );
    expect(resolveCardArtwork("grade/upper-secondary", "ms")).toBeUndefined();
    expect(
      resolveCardArtwork("tryout/malaysia/spm/physics", "ms")
    ).toBeUndefined();
    expect(resolveCardArtwork(undefined, "ms")).toBeUndefined();
  });

  it("shares the English readers' file as the social image of a locale not drawn yet", () => {
    expect(resolveStaticArtwork("grade/upper-secondary", "ms")).toBe(
      "/open-graph/grade/en-upper-secondary.png"
    );
    expect(resolveStaticArtwork("subject/physics", "de")).toBe(
      "/open-graph/subject/de-physics.png"
    );
    // The German Darmstadt mathematics design has no English lettering yet.
    expect(
      resolveSocialArtwork({
        identity:
          "tryout/germany/entrance-examination/tu-darmstadt-mathematics",
        locale: "id",
        publicPath: "try-out/jerman",
      })
    ).toBe("/id/og/image.png");
  });

  it("reads every design in active locales only", () => {
    const strays = Arr.flatMap(Rec.toEntries(artworkSources), ([, readers]) =>
      Arr.filter(
        [...Rec.keys(readers), ...Rec.values(readers)],
        (locale) => !Arr.contains(ACTIVE_APP_LOCALE_CODES, locale)
      )
    );

    expect(strays).toEqual([]);
  });

  it("shows an exam's own name in its one design in every locale", () => {
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      expect(
        resolveCardArtwork("tryout/germany/entrance-examination", locale)
      ).toBe("/open-graph/tryout/germany/en-entrance-examination.png");
      expect(resolveCardArtwork("tryout/indonesia/snbt", locale)).toBe(
        "/open-graph/tryout/indonesia/en-snbt.png"
      );
    }
  });

  it("answers the home image when an identity has no artwork", () => {
    expect(
      resolveSocialArtwork({
        identity: undefined,
        locale: "de",
        publicPath: "unbekannt",
      })
    ).toBe("/de/og/image.png");
  });

  it("resolves app surfaces through stable keys", () => {
    expect(
      getAppSocialArtwork({ key: "quran", locale: "de", publicPath: "quran" })
    ).toBe("/open-graph/quran/en-index.png");
    expect(
      getAppSocialArtwork({ key: "school", locale: "id", publicPath: "school" })
    ).toBe("/open-graph/app/en-school.png");
    expect(
      getAppSocialArtwork({ key: "ask-nina", locale: "id", publicPath: "chat" })
    ).toBe("/open-graph/app/id-ask-nina.png");
    // Malay reads tanya Nina, the Indonesian lettering.
    expect(
      getAppSocialArtwork({ key: "ask-nina", locale: "ms", publicPath: "chat" })
    ).toBe("/open-graph/app/id-ask-nina.png");
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
    expect(
      getAppSocialArtwork({ key: "landing", locale: "id", publicPath: "" })
    ).toBe("/open-graph/app/id-landing.png");
    expect(
      getAppSocialArtwork({ key: "landing", locale: "de", publicPath: "" })
    ).toBe("/open-graph/app/de-landing.png");
    // Malay has no landing lettering of its own, so it shows the English default.
    expect(
      getAppSocialArtwork({ key: "landing", locale: "ms", publicPath: "" })
    ).toBe("/open-graph/app/en-landing.png");
  });

  it("draws a card's artwork from its WebP, and leaves a generated image alone", () => {
    expect(toCardArtwork("/open-graph/tryout/en-index.png")).toBe(
      "/open-graph/tryout/en-index.webp"
    );
    expect(toCardArtwork("/en/og/subjects/math/image.png")).toBe(
      "/en/og/subjects/math/image.png"
    );
  });

  it.effect("holds a WebP beside every artwork a card can draw", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const artworkRoot = path.join(process.cwd(), "public");

      const missing = yield* Effect.filter(listStaticArtwork(), (file) =>
        Effect.map(
          fs.exists(path.join(artworkRoot, toCardArtwork(file))),
          (exists) => !exists
        )
      );

      expect(missing).toEqual([]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("keeps the manifest and filesystem in exact agreement", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const artworkRoot = path.join(process.cwd(), "public", "open-graph");
      const manifestPaths = listStaticArtwork();
      const entries = yield* fs.readDirectory(artworkRoot, { recursive: true });
      const filesystemPaths = Arr.filter(entries, (entry) =>
        entry.endsWith(".png")
      );
      const cardPaths = Arr.filter(entries, (entry) => entry.endsWith(".webp"));
      const publicFilesystemPaths = Arr.map(
        filesystemPaths,
        (entry) => `/open-graph/${entry}`
      );

      expect(Arr.dedupe(manifestPaths)).toHaveLength(manifestPaths.length);
      expect(Arr.sort(publicFilesystemPaths, Order.String)).toEqual(
        Arr.sort(manifestPaths, Order.String)
      );
      // A card's WebP stands beside its PNG, never alone.
      expect(
        Arr.sort(
          Arr.map(cardPaths, (entry) => `/open-graph/${entry}`),
          Order.String
        )
      ).toEqual(Arr.sort(Arr.map(manifestPaths, toCardArtwork), Order.String));
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
