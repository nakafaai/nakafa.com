import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Effect,
  FileSystem,
  Path,
  Schema,
  String as Str,
} from "effect";
import { Digest } from "effect/crypto";
import { Base64 } from "effect/encoding";
import { HttpClient, HttpClientResponse } from "effect/http";
import subsetFont from "subset-font";
import { runEntry } from "#scripts/entry";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RANGE_PATTERN =
  /^U\+(?<first>[0-9A-F]{1,6})(?:-(?<last>[0-9A-F]{1,6}))?$/u;

/** The Allo release every face comes from: SIL OFL 1.1, with no Reserved Font Name. */
const RELEASE = {
  commit: "60992c5e12a4ad5cad41c54cd8dba370163a4828",
  repository: "joshpuckett/allo",
  tag: "v1.0.3",
};
const releaseFile = (file: string) =>
  `https://raw.githubusercontent.com/${RELEASE.repository}/${RELEASE.commit}/${file}`;

/**
 * Allo rounded at its Text size: roundness pinned to 100, optical size to 14,
 * and weight kept from 400 to 600, the regular, medium and semibold the type
 * scale draws. Keeping the optical size range would more than double the Latin
 * face, and every weight outside the scale costs bytes no page draws.
 */
const ALLO_AXES = {
  opsz: 14,
  ROND: 100,
  wght: { max: 600, min: 400 },
};

/** One file of the release, and the SHA-256 of its bytes at the pinned commit. */
const PinnedFile = Schema.Struct({
  sha256: Schema.String.pipe(Schema.check(Schema.isPattern(SHA256_PATTERN))),
  url: Schema.String,
});
type PinnedFile = typeof PinnedFile.Type;

/** One axis pinned to a value, or limited to a range. */
const Axis = Schema.Union([
  Schema.Finite,
  Schema.Struct({ max: Schema.Finite, min: Schema.Finite }),
]);

const AlloConfig = Schema.Struct({
  axes: Schema.Record(Schema.String, Axis),
  font: PinnedFile,
  license: PinnedFile,
  repositoryRoot: Schema.String,
});
/** Where the release lives, the instance cut from it, and where the generated files go. */
export type AlloConfig = typeof AlloConfig.Type;
const DEFAULT_CONFIG: AlloConfig = {
  axes: ALLO_AXES,
  font: {
    sha256: "cdc994466d3a2dc77d5f72bd4f60c1bbf4d65dad5901ac064c7cc04e182c4fe4",
    url: releaseFile("fonts/variable/AlloVariable.ttf"),
  },
  license: {
    sha256: "abd0d6f604be7d1471efaa0bf89bca030d4a666437bfb507b85974d127902690",
    url: releaseFile("OFL.txt"),
  },
  repositoryRoot: ".",
};

/** The design system's faces and license, which the stylesheet names by these paths. */
export const FONT_FOLDER = "packages/design-system/fonts/allo";
export const STYLESHEET = "packages/design-system/styles/allo.css";
/** The faces a document draws with, carried in a module because a Convex action reads no file of the design system. */
export const PDF_MODULE = "packages/backend/confect/pdf/allo.ts";

/** The layout features the app reads: kerning, ligatures, marks, case forms, and tabular digits. */
const ALLO_FEATURES = [
  "calt",
  "case",
  "ccmp",
  "kern",
  "liga",
  "locl",
  "mark",
  "mkmk",
  "tnum",
];

/** One subset of the family: its name, which names its file, and the code points it draws. */
const AlloSubset = Schema.Struct({
  ranges: Schema.String,
  subset: Schema.String,
});
type AlloSubset = typeof AlloSubset.Type;
/** One subset with its instanced WOFF2 bytes. */
const AlloFace = Schema.Struct({
  ...AlloSubset.fields,
  data: Schema.Uint8Array,
});
type AlloFace = typeof AlloFace.Type;

/**
 * The subsets, with Google Fonts' unicode ranges, in its order: a code point
 * that two ranges hold takes the face declared last. `extended` is Google's
 * `latin-ext`. Allo draws no Cyrillic or Greek, which fall through to the
 * system stack.
 */
export const ALLO_SUBSETS: readonly AlloSubset[] = [
  {
    ranges:
      "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
    subset: "vietnamese",
  },
  {
    ranges:
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
    subset: "extended",
  },
  {
    ranges:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
    subset: "latin",
  },
];

class AlloDownloadError extends Schema.TaggedError<
  AlloDownloadError,
  { readonly brand: unique symbol }
>()("AlloDownloadError", { message: Schema.String }) {}
class AlloSourceMismatch extends Schema.TaggedError<
  AlloSourceMismatch,
  { readonly brand: unique symbol }
>()("AlloSourceMismatch", { message: Schema.String }) {}
class AlloSubsetError extends Schema.TaggedError<
  AlloSubsetError,
  { readonly brand: unique symbol }
>()("AlloSubsetError", { message: Schema.String }) {}
class AlloWriteError extends Schema.TaggedError<
  AlloWriteError,
  { readonly brand: unique symbol }
>()("AlloWriteError", { message: Schema.String }) {}

/** Every character of a CSS unicode range such as `U+0041-005A,U+00E9`, for hb-subset to keep. */
export const rangeText = Effect.fn("AlloFonts.rangeText")(function* (
  ranges: string
) {
  const characters = yield* Effect.forEach(Str.split(ranges, ","), (entry) => {
    const bounds = RANGE_PATTERN.exec(entry)?.groups;
    if (bounds?.first === undefined) {
      return Effect.fail(
        new AlloSubsetError({ message: `${entry} is not a unicode range.` })
      );
    }
    const first = Number.parseInt(bounds.first, 16);
    const last = Number.parseInt(bounds.last ?? bounds.first, 16);
    return Effect.succeed(
      Arr.join(
        Arr.map(Arr.range(first, last), (point) => String.fromCodePoint(point)),
        ""
      )
    );
  });
  return Arr.join(characters, "");
});

/** The file of one subset's face, in the design system's font folder. */
export const faceFile = (subset: string) => `${subset}.woff2`;

/** The `@font-face` rules of every subset, as the design system's global stylesheet imports them. */
export function renderStylesheet(subsets: readonly AlloSubset[]) {
  const faces = Arr.map(
    subsets,
    ({ ranges, subset }) => `@font-face {
  font-family: "Allo";
  font-style: normal;
  font-display: swap;
  font-weight: ${ALLO_AXES.wght.min} ${ALLO_AXES.wght.max};
  src: url("../fonts/allo/${faceFile(subset)}") format("woff2");
  unicode-range:
    ${Arr.join(Str.split(ranges, ","), ", ")};
}
`
  );
  return `/* @generated by \`bun run fonts:allo\` (scripts/fonts/allo.ts). Do not edit.
 *
 * Allo ${RELEASE.tag}, the face every page's text draws in, rounded at its Text size and subset as Google
 * Fonts subsets a family, so a page loads only the subsets its characters need. Swap display draws the
 * text at once in the fallback faces of globals.css, which hold Allo's width and line metrics, so the swap
 * moves no line. The root document preloads the Latin face. License: ../fonts/allo/OFL.txt. */
${Arr.join(faces, "\n")}`;
}

/** The module that carries every face to the PDF renderer as Base64. */
export function renderPdfModule(faces: readonly AlloFace[]) {
  const entries = Arr.map(
    faces,
    ({ data, ranges, subset }) => `  {
    data: "${Base64.encode(data)}",
    ranges:
      "${ranges}",
    subset: "${subset}",
  },
`
  );
  return `/**
 * @generated by \`bun run fonts:allo\` (scripts/fonts/allo.ts). Do not edit.
 *
 * Allo's faces as the design system serves them (\`packages/design-system/fonts/allo\`),
 * in WOFF2 as Base64, with the code points each one draws. A Convex action reads
 * no file of the design system, so documents carry the faces themselves, and
 * \`allo.test.ts\` keeps the two equal.
 */
export const ALLO_FACES = [
${Arr.join(entries, "")}];
`;
}

/** Downloads one release file and fails unless its bytes are the pinned ones. */
const fetchPinned = Effect.fn("AlloFonts.fetch")(function* (file: PinnedFile) {
  const client = yield* HttpClient.HttpClient;
  const bytes = yield* client.get(file.url).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.arrayBuffer),
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.mapError(
      (error) =>
        new AlloDownloadError({
          message: `${file.url} could not be downloaded: ${error.message}`,
        })
    )
  );
  const digest = yield* Digest.Digest;
  const sha256 = yield* digest.digestHex(Digest.sha256, bytes);
  if (sha256 !== file.sha256) {
    return yield* new AlloSourceMismatch({
      message: `${file.url} has SHA-256 ${sha256}, but the release pins ${file.sha256}.`,
    });
  }
  return bytes;
});

/** Instances the variable font at Allo's axes and subsets it to one subset's ranges as WOFF2. */
const instanceFace = Effect.fn("AlloFonts.instance")(function* (
  font: Uint8Array,
  axes: AlloConfig["axes"],
  subset: AlloSubset
) {
  const text = yield* rangeText(subset.ranges);
  const data = yield* Effect.tryPromise({
    // hb-subset reads the font through fontverter, which takes a Node Buffer.
    try: () =>
      subsetFont(Buffer.from(font), text, {
        keepFeatures: ALLO_FEATURES,
        targetFormat: "woff2",
        variationAxes: axes,
      }),
    catch: (cause) =>
      new AlloSubsetError({
        message: `The ${subset.subset} face could not be made: ${String(cause)}`,
      }),
  });
  return { ...subset, data: new Uint8Array(data) };
});

/** Writes the faces, the license, the stylesheet, and the PDF module below the repository root. */
const writeOutputs = Effect.fn("AlloFonts.write")(
  function* (root: string, faces: readonly AlloFace[], license: Uint8Array) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const fonts = path.join(root, FONT_FOLDER);
    yield* fs.makeDirectory(fonts, { recursive: true });
    yield* Effect.forEach(faces, (face) =>
      fs.writeFile(path.join(fonts, faceFile(face.subset)), face.data)
    );
    yield* fs.writeFile(path.join(fonts, "OFL.txt"), license);
    yield* fs.writeFileString(
      path.join(root, STYLESHEET),
      renderStylesheet(faces)
    );
    yield* fs.writeFileString(
      path.join(root, PDF_MODULE),
      renderPdfModule(faces)
    );
  },
  Effect.mapError((error) => new AlloWriteError({ message: error.message }))
);

/** Downloads the pinned release, verifies it, and writes every generated Allo file. */
export const makeAlloProgram = Effect.fn("AlloFonts.main")(function* (
  config: AlloConfig = DEFAULT_CONFIG
) {
  const [font, license] = yield* Effect.all(
    [fetchPinned(config.font), fetchPinned(config.license)],
    { concurrency: 2 }
  );
  const faces = yield* Effect.forEach(ALLO_SUBSETS, (subset) =>
    instanceFace(font, config.axes, subset)
  );
  yield* writeOutputs(config.repositoryRoot, faces, license);
  yield* Effect.log(
    Arr.join(
      Arr.map(
        faces,
        (face) => `${faceFile(face.subset)}: ${face.data.length} B`
      ),
      ", "
    )
  );
});

runEntry(
  import.meta.main,
  makeAlloProgram().pipe(Effect.provide([FetchClient, Digest.layerWebCrypto]))
);
