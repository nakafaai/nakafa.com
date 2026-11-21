import { NodeServices } from "@effect/platform-node";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { FetchClient } from "@repo/utilities/http/client";
import type { Path } from "effect";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Layer,
  Order,
  Result,
  String as Str,
} from "effect";
import { Digest } from "effect/crypto";
import type { HttpClient } from "effect/http";
import { FetchHttpClient } from "effect/http";
import type { AlloConfig } from "#scripts/fonts/allo";
import {
  ALLO_SUBSETS,
  FONT_FOLDER,
  faceFile,
  makeAlloProgram,
  PDF_MODULE,
  rangeText,
  renderPdfModule,
  renderStylesheet,
  STYLESHEET,
} from "#scripts/fonts/allo";

const FONT_URL = "https://fonts.test/allo.woff2";
const LICENSE_URL = "https://fonts.test/OFL.txt";
const LICENSE = "SIL Open Font License 1.1\n";
const RELEASE =
  "https://raw.githubusercontent.com/joshpuckett/allo/60992c5e12a4ad5cad41c54cd8dba370163a4828";
const ROOT = `${import.meta.dirname}/../..`;

/** One fetch double for the whole file, provided to the program's own client. */
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
});

/** Reads one committed file of the repository. */
const readRepositoryFile = Effect.fn("AlloFontsTest.read")(function* (
  file: string
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFile(`${ROOT}/${file}`);
});

/** The committed faces, in the order the generator makes them. */
const committedFaces = Effect.forEach(ALLO_SUBSETS, (subset) =>
  Effect.map(
    readRepositoryFile(`${FONT_FOLDER}/${faceFile(subset.subset)}`),
    (data) => ({ ...subset, data })
  )
);

/** The SHA-256 of some bytes as the release pins it. */
const sha256 = Effect.fn("AlloFontsTest.sha256")(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  return yield* digest.digestHex(Digest.sha256, bytes);
});

/** Answers each release URL with its bytes, and any other with a 404. */
function serve(files: Readonly<Record<string, Uint8Array>>) {
  fetcher.mockImplementation((input) => {
    const body = files[String(input)];
    return Promise.resolve(
      body === undefined
        ? new Response("missing", { status: 404 })
        : new Response(body.slice(), { status: 200 })
    );
  });
}

/**
 * A release whose font is the committed Latin face, which keeps its weight
 * axis, so the program instances it at that axis alone.
 */
const fixtureRelease = Effect.fn("AlloFontsTest.release")(function* (
  repositoryRoot: string
) {
  const font = yield* readRepositoryFile(`${FONT_FOLDER}/${faceFile("latin")}`);
  const license = new TextEncoder().encode(LICENSE);
  serve({ [FONT_URL]: font, [LICENSE_URL]: license });
  const config: AlloConfig = {
    axes: { wght: { max: 600, min: 400 } },
    font: { sha256: yield* sha256(font), url: FONT_URL },
    license: { sha256: yield* sha256(license), url: LICENSE_URL },
    repositoryRoot,
  };
  return config;
});

/** Runs a test with the platform, Web Crypto, and this file's fetch double. */
const provide = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Digest.Digest | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path
  >
) =>
  effect.pipe(
    Effect.provide(
      Layer.mergeAll(NodeServices.layer, Digest.layerWebCrypto, FetchClient)
    ),
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );

describe("Allo fonts", () => {
  it.effect("reads every character of a unicode range", () =>
    Effect.gen(function* () {
      expect(yield* rangeText("U+0041-0043,U+00E9")).toBe("ABCé");
      const malformed = yield* Effect.result(rangeText("U+0041,0042"));
      expect(Result.isFailure(malformed) && malformed.failure.message).toBe(
        "0042 is not a unicode range."
      );
    })
  );

  it.effect("renders the committed stylesheet and PDF module", () =>
    provide(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const faces = yield* committedFaces;
        expect(renderStylesheet(ALLO_SUBSETS)).toBe(
          yield* fs.readFileString(`${ROOT}/${STYLESHEET}`)
        );
        expect(renderPdfModule(faces)).toBe(
          yield* fs.readFileString(`${ROOT}/${PDF_MODULE}`)
        );
      })
    )
  );

  it.effect("declares each subset as one face of weights 400 to 600", () =>
    Effect.sync(() => {
      const sheet = renderStylesheet(ALLO_SUBSETS);
      expect(Str.split(sheet, "@font-face {").length).toBe(4);
      expect(sheet).toContain("font-weight: 400 600;");
      expect(sheet).toContain(
        'src: url("../fonts/allo/latin.woff2") format("woff2");'
      );
      expect(sheet).toContain("U+0000-00FF, U+0131, U+0152-0153");
    })
  );

  it.effect("writes the faces, license, stylesheet, and PDF module", () =>
    provide(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(`${root}/packages/design-system/styles`, {
          recursive: true,
        });
        yield* fs.makeDirectory(`${root}/packages/backend/confect/pdf`, {
          recursive: true,
        });
        yield* makeAlloProgram(yield* fixtureRelease(root));

        const faces = yield* Effect.forEach(ALLO_SUBSETS, (subset) =>
          Effect.map(
            fs.readFile(`${root}/${FONT_FOLDER}/${faceFile(subset.subset)}`),
            (data) => ({ ...subset, data })
          )
        );
        for (const face of faces) {
          expect(face.data.length).toBeGreaterThan(0);
        }
        expect(yield* fs.readFileString(`${root}/${FONT_FOLDER}/OFL.txt`)).toBe(
          LICENSE
        );
        expect(yield* fs.readFileString(`${root}/${STYLESHEET}`)).toBe(
          renderStylesheet(ALLO_SUBSETS)
        );
        expect(yield* fs.readFileString(`${root}/${PDF_MODULE}`)).toBe(
          renderPdfModule(faces)
        );
      }).pipe(Effect.scoped)
    )
  );

  it.effect("refuses a release whose bytes are not the pinned ones", () =>
    provide(
      Effect.gen(function* () {
        const config = yield* fixtureRelease("unused");
        const error = yield* Effect.flip(
          makeAlloProgram({
            ...config,
            font: { ...config.font, sha256: "0".repeat(64) },
          })
        );
        expect(error._tag).toBe("AlloSourceMismatch");
        expect(error.message).toContain(`${FONT_URL} has SHA-256`);
      })
    )
  );

  it.effect("downloads the release at its pinned commit by default", () =>
    provide(
      Effect.gen(function* () {
        serve({});
        const error = yield* Effect.flip(makeAlloProgram());
        expect(error._tag).toBe("AlloDownloadError");
        const requested = Arr.map(fetcher.mock.calls, ([input]) =>
          String(input)
        );
        // The two downloads run concurrently, so their order is not fixed.
        expect(Arr.sort(requested, Order.String)).toEqual([
          `${RELEASE}/OFL.txt`,
          `${RELEASE}/fonts/variable/AlloVariable.ttf`,
        ]);
      })
    )
  );

  it.effect("fails when a release file cannot be downloaded", () =>
    provide(
      Effect.gen(function* () {
        const config = yield* fixtureRelease("unused");
        const error = yield* Effect.flip(
          makeAlloProgram({
            ...config,
            license: { ...config.license, url: "https://fonts.test/gone" },
          })
        );
        expect(error._tag).toBe("AlloDownloadError");
      })
    )
  );

  it.effect("fails when the font cannot be subset", () =>
    provide(
      Effect.gen(function* () {
        const config = yield* fixtureRelease("unused");
        const junk = new TextEncoder().encode("not a font");
        serve({
          [FONT_URL]: junk,
          [LICENSE_URL]: new TextEncoder().encode(LICENSE),
        });
        const error = yield* Effect.flip(
          makeAlloProgram({
            ...config,
            font: { sha256: yield* sha256(junk), url: FONT_URL },
          })
        );
        expect(error._tag).toBe("AlloSubsetError");
        expect(error.message).toContain(
          "The vietnamese face could not be made"
        );
      })
    )
  );

  it.effect("fails when the outputs cannot be written", () =>
    provide(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        // The repository root is a file, so no folder can be made below it.
        yield* fs.writeFileString(`${root}/file`, "");
        const error = yield* Effect.flip(
          makeAlloProgram(yield* fixtureRelease(`${root}/file`))
        );
        expect(error._tag).toBe("AlloWriteError");
      }).pipe(Effect.scoped)
    )
  );
});
