import {
  appendResponseHeader,
  getRequestHeader,
} from "@tanstack/react-start/server";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  appendStaticCalls,
  PRERENDER_HEADER,
  StaticCall,
} from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";

/**
 * The response header that carries one recorded call, Base64URL-encoded, from the
 * loader that made it to the server entry, which moves the calls into the page.
 */
const CALL_HEADER = "x-nakafa-static-call";

/** One recorded call as the JSON text that its header value encodes. */
const StaticCallJson = Schema.fromJsonString(StaticCall);

/** Reports whether a request is the build's prerender of a page. */
function isPrerender(header: string | null | undefined): boolean {
  return header === "1";
}

/**
 * Whether the request that the server answers now is the build's prerender of a
 * page, so a route can tell an answer that the build keeps for every visitor from
 * one that a visitor's own request read.
 */
export function isPrerenderRequest(): boolean {
  return isPrerender(getRequestHeader(PRERENDER_HEADER));
}

/**
 * Records one server function call of a page that the build prerenders, so the
 * build can write its answer as a static file. A visitor's request records
 * nothing and computes no key.
 */
export const recordStaticCall = Effect.fn("www.static.recordCall")(function* (
  url: string,
  data: unknown
) {
  if (!isPrerender(getRequestHeader(PRERENDER_HEADER))) {
    return;
  }
  const key = yield* staticCallKey(url, data);
  const call = yield* Schema.encodeEffect(StaticCallJson)({ data, key, url });
  appendResponseHeader(CALL_HEADER, Base64Url.encode(call));
}, Effect.orDie);

/** Reads the calls that the loaders of one prerendered page recorded in its headers. */
function readRecordedCalls(header: string | null): readonly StaticCall[] {
  return Arr.getSomes(
    Arr.map(header === null ? [] : header.split(", "), (value) =>
      Option.flatMap(
        Result.getSuccess(Base64Url.decodeString(value)),
        Schema.decodeOption(StaticCallJson)
      )
    )
  );
}

/**
 * Moves the recorded calls of a prerendered page from its headers into the comment
 * that closes its HTML, which the build reads. Any other answer passes unchanged.
 */
export const attachStaticCalls = Effect.fn("www.static.attachCalls")(function* (
  request: Request,
  response: Response
) {
  if (!isPrerender(request.headers.get(PRERENDER_HEADER))) {
    return response;
  }
  const calls = readRecordedCalls(response.headers.get(CALL_HEADER));
  const headers = new Headers(response.headers);
  headers.delete(CALL_HEADER);
  const html = yield* Effect.promise(() => response.text());
  return new Response(appendStaticCalls(html, calls), {
    headers,
    status: response.status,
  });
});
