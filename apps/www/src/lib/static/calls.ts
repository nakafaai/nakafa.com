import { Array as Arr, Option, Result, Schema } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * One server function call that a prerendered page's loader made: the key of the
 * static file that holds its answer, the function's address, and its input.
 */
export const StaticCall = Schema.Struct({
  data: Schema.Unknown,
  key: Schema.String,
  url: Schema.String,
});

export type StaticCall = typeof StaticCall.Type;

/** The calls of one page as the JSON text that its closing comment carries. */
const StaticCallsJson = Schema.fromJsonString(Schema.Array(StaticCall));

/**
 * The comment that closes a prerendered page and lists, Base64URL-encoded, the calls
 * its loaders made. The build reads it, writes the answer of each call as a static
 * file, and removes it, so no deployed page carries it. The encoding keeps any input
 * text from closing the comment early.
 */
const COMMENT_START = "<!--nakafa-static:";
const COMMENT_END = "-->";

/**
 * The request header that the build's prerender sends, so the Worker records the
 * server function calls of the page it renders. No visitor's request carries it.
 */
export const PRERENDER_HEADER = "x-nakafa-prerender";

/** The folder of the static answers, which the browser reads in place of a server call. */
const STATIC_DATA_FOLDER = "/_data";

/** The byte that ends the content type line of a static answer. */
const LINE_END = 10;

/** Closes a prerendered page with the comment that lists the calls its loaders made. */
export function appendStaticCalls(
  html: string,
  calls: readonly StaticCall[]
): string {
  const encoded = Base64Url.encode(Schema.encodeSync(StaticCallsJson)(calls));
  return `${html}${COMMENT_START}${encoded}${COMMENT_END}`;
}

/**
 * Splits a prerendered page into its document without the closing comment and the
 * calls that the comment lists. A page that the Worker rendered without recording
 * has no comment, and reads as none.
 */
export function readStaticCalls(html: string) {
  const start = html.lastIndexOf(COMMENT_START);
  if (start === -1 || !html.endsWith(COMMENT_END)) {
    return Option.none();
  }
  const encoded = html.slice(
    start + COMMENT_START.length,
    html.length - COMMENT_END.length
  );
  return Option.map(
    Option.flatMap(
      Result.getSuccess(Base64Url.decodeString(encoded)),
      Schema.decodeOption(StaticCallsJson)
    ),
    (calls) => ({ calls, html: html.slice(0, start) })
  );
}

/**
 * The address of the static file that holds the answer of one call. The file name
 * ends in an extension, so a missing answer is a missing file, which the Worker
 * answers with the static not-found page and never moves to a locale.
 */
export function staticDataPath(key: string): string {
  return `${STATIC_DATA_FOLDER}/${key}.bin`;
}

/**
 * Writes the answer of one call as a static file: its content type on the first
 * line, then its body byte for byte. A server function answers in two forms, framed
 * or JSON, and the browser's decoder chooses by that type.
 */
export function toStaticFile(
  contentType: string,
  body: Uint8Array
): Uint8Array<ArrayBuffer> {
  const line = new TextEncoder().encode(`${contentType}\n`);
  const file = new Uint8Array(line.length + body.length);
  file.set(line);
  file.set(body, line.length);
  return file;
}

/** Reads a static file back into the content type and the body of its answer. */
export function readStaticFile(file: Uint8Array<ArrayBuffer>) {
  return Option.map(
    Arr.findFirstIndex(file, (byte) => byte === LINE_END),
    (end) => ({
      body: file.slice(end + 1),
      contentType: new TextDecoder().decode(file.slice(0, end)),
    })
  );
}
