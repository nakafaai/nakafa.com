import { FetchClient } from "@repo/utilities/http/client";
import {
  Array as Arr,
  Effect,
  HashSet,
  Layer,
  Option,
  Schedule,
  Schema,
} from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { toLedgerPath } from "@/scripts/urls/ledger";

/** The redirects a published address may take on its way to its page. */
const REDIRECT_STATUSES = HashSet.make(301, 302, 303, 307, 308);

/** More hops than this is a chain no crawler should have to follow. */
const MAX_REDIRECTS = 3;

/** How long one hop may take before it counts as unanswered. */
const HOP_TIMEOUT = "15 seconds";

/** A hop that failed in a way a second try can fix: no answer, or a 5xx. */
class UnsteadyHopError extends Schema.TaggedError<
  UnsteadyHopError,
  { readonly brand: unique symbol }
>()("UnsteadyHopError", { status: Schema.Finite }) {}

/** One request on the way: the path asked for and the status it answered. */
const HopSchema = Schema.Struct({ path: Schema.String, status: Schema.Finite });
type Hop = typeof HopSchema.Type;

/**
 * What one published address answers now. `kept` ends in a page (200), `gone`
 * in 410 Gone, and `broken` anywhere else: a 404, a 5xx, no answer, a redirect
 * off the site, or a chain longer than `MAX_REDIRECTS`.
 */
const AnswerSchema = Schema.Struct({
  hops: Schema.Array(HopSchema),
  path: Schema.String,
  verdict: Schema.Literals(["broken", "gone", "kept"]),
});
export type Answer = typeof AnswerSchema.Type;

/**
 * The client that sees each redirect as it arrives instead of following it, so
 * every hop of a chain is checked. Only the Fetch client honors that option.
 */
const HopHttpClient = FetchClient.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, {
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
    })
  )
);

/** The status and the location of one request, retrying an unsteady answer twice. */
const askHop = Effect.fn("scripts.urls.askHop")(
  function* (url: URL) {
    // The scope aborts the request, so no page body is read.
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const response = yield* client
      .execute(
        HttpClientRequest.get(url).pipe(
          HttpClientRequest.setHeader("user-agent", "NakafaUrlContract")
        )
      )
      .pipe(
        Effect.timeoutOrElse({
          duration: HOP_TIMEOUT,
          orElse: () => Effect.fail(new UnsteadyHopError({ status: 0 })),
        }),
        Effect.mapError(() => new UnsteadyHopError({ status: 0 }))
      );
    if (response.status >= 500) {
      return yield* new UnsteadyHopError({ status: response.status });
    }
    return {
      location: Option.fromNullishOr(response.headers.location),
      status: response.status,
    };
  },
  Effect.scoped,
  Effect.retry({ schedule: Schedule.exponential("1 second"), times: 2 }),
  Effect.catchTag("UnsteadyHopError", ({ status }) =>
    Effect.succeed({ location: Option.none<string>(), status })
  )
);

/** The answer that the hops so far settle on. */
function settle(
  path: string,
  hops: readonly Hop[],
  verdict: Answer["verdict"]
) {
  return { hops, path, verdict } satisfies Answer;
}

/** Follows one published path on the site, hop by hop, to the answer it ends in. */
export const readAnswer = Effect.fn("scripts.urls.readAnswer")(function* (
  origin: string,
  path: string
) {
  let hops: readonly Hop[] = [];
  let current = path;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = new URL(current, origin);
    const { location, status } = yield* askHop(url);
    hops = Arr.append(hops, { path: current, status });
    if (status === 200) {
      return settle(path, hops, "kept");
    }
    if (status === 410) {
      return settle(path, hops, "gone");
    }
    const next = Option.flatMap(
      Option.filter(location, () => HashSet.has(REDIRECT_STATUSES, status)),
      (target) => toLedgerPath(target, url.href)
    );
    if (Option.isNone(next)) {
      return settle(path, hops, "broken");
    }
    current = next.value;
  }
  return settle(path, hops, "broken");
}, Effect.provide(HopHttpClient));
