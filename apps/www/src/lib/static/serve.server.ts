import { env } from "cloudflare:workers";
import { X_TSS_SERIALIZED } from "@tanstack/react-start";
import {
  Array as Arr,
  Effect,
  HashSet,
  Option,
  Predicate,
  Schema,
} from "effect";
import { fromJSON, type SerovalJSON } from "seroval";
import { readTryoutCountryFn } from "@/components/tryout/route/catalog.functions";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { hasStaticRelease } from "@/lib/routing/release";
import { readStaticFile, staticDataPath } from "@/lib/static/calls";
import { staticCallKey } from "@/lib/static/key";

/**
 * The server functions whose static answers the Worker serves in place of their
 * handlers. Each takes everything its answer depends on in its input and reads
 * only the release: a route's messages read the release's dictionaries, and a
 * try-out country reads the release's catalog. So the answer that the build wrote
 * for an input is the answer the handler would give it in this release. A function
 * that reads the request, a session or live data stays on its handler.
 */
const STATIC_FUNCTIONS = HashSet.make(
  readRouteMessages.url,
  readTryoutCountryFn.url
);

/** The query parameter that carries a GET server function's serialized input. */
const PAYLOAD_PARAMETER = "payload";

/** A call's payload as JSON text, the Seroval document that Start's client writes. */
const PayloadJson = Schema.fromJsonString(Schema.Unknown);

/** Whether a JSON value has the shape of a Seroval document: a root node, its features and its marks. */
function isSerovalJson(value: unknown): value is SerovalJSON {
  return (
    Predicate.isObject(value) &&
    Predicate.hasProperty(value, "t") &&
    Predicate.isObject(value.t) &&
    Predicate.hasProperty(value, "f") &&
    Predicate.isNumber(value.f) &&
    Predicate.hasProperty(value, "m") &&
    Arr.isArray(value.m)
  );
}

/** What a server function call carries once Seroval reads it: its input. */
const CallPayload = Schema.Struct({ data: Schema.Unknown });

/** The input of a call as its client serialized it, or none when it does not read as one. */
const readCallData = Effect.fn("www.static.readCallData")(
  function* (payload: string) {
    const json = yield* Schema.decodeEffect(PayloadJson)(payload);
    if (!isSerovalJson(json)) {
      return Option.none();
    }
    const call = yield* Effect.try(() => fromJSON<unknown>(json));
    const decoded = yield* Schema.decodeUnknownEffect(CallPayload)(call);
    return Option.some(decoded.data);
  },
  Effect.orElseSucceed(() => Option.none())
);

/**
 * Answers a GET call of a static function from the answer that the build wrote
 * for its exact input, before its handler runs. The browser reads the same file
 * before it calls the Worker (`readStaticData`), so this serves only a client that
 * missed it, such as a crawler's renderer. The file is keyed by the function's
 * address and its input as the client wrote it (`staticCallKey`), so a call the
 * build never made, an input that does not read, or a prerender, which binds no
 * assets and records its calls by running them, answers none and the handler runs.
 */
export const answerStaticFunction = Effect.fn("www.static.serve")(function* (
  request: Request
) {
  const url = new URL(request.url);
  const payload = url.searchParams.get(PAYLOAD_PARAMETER);
  if (
    request.method !== "GET" ||
    payload === null ||
    !HashSet.has(STATIC_FUNCTIONS, url.pathname) ||
    !hasStaticRelease()
  ) {
    return Option.none<Response>();
  }
  const data = yield* readCallData(payload);
  if (Option.isNone(data)) {
    return Option.none<Response>();
  }
  const key = yield* staticCallKey(url.pathname, data.value);
  const asset = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(staticDataPath(key), url)))
  );
  if (asset.status !== 200) {
    return Option.none<Response>();
  }
  const bytes = yield* Effect.promise(() => asset.arrayBuffer());
  return Option.map(
    readStaticFile(new Uint8Array(bytes)),
    (file) =>
      new Response(file.body, {
        headers: {
          "content-type": file.contentType,
          [X_TSS_SERIALIZED]: "true",
        },
      })
  );
});
