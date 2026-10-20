import { getConvexFunctionName } from "@confect/core/Ref";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  Array as Arr,
  Cause,
  Effect,
  Logger,
  MutableList,
  Schema,
} from "effect";
import { readSchoolRefusal } from "@/lib/routing/school/refusal";

/**
 * The fake backend of the school gate: one fetch double for the whole test file,
 * which the file stubs once and resets between tests. The Convex client sends each
 * query through the global `fetch` of its own promise call, and the session token
 * route goes through the Effect client, which reads the global `fetch` too, so
 * both reach this double.
 */
export const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

export const SCHOOL_ROOT = "https://harapan.nakafa.com/";
export const SESSION_COOKIE = "better-auth.session_token=session-value";
export const TOKEN = "session-token";
export const TOKEN_PATH = "/api/auth/convex/token";
const PROFILE = getConvexFunctionName(tenancy.profile.get);
export const REFUSAL = getConvexFunctionName(tenancy.profile.refusal);

/** One answer of the fake backend. It is a function, so a request can wait or fail. */
type Route = () => Promise<Response>;

/** The reads that a test answers: the token route and the school queries. */
type ReadName = "profile" | "refusal" | "token" | "viewer";

/** One request that the fake backend served: a token read, with no slug, or a school query. */
const ServedRequest = Schema.Struct({
  auth: Schema.NullOr(Schema.String),
  path: Schema.String,
  slug: Schema.UndefinedOr(Schema.String),
});
type ServedRequest = typeof ServedRequest.Type;

/** The body that the Convex HTTP client sends for one query of a school. */
const QueryBody = Schema.fromJsonString(
  Schema.Struct({
    args: Schema.Tuple([Schema.Struct({ slug: Schema.String })]),
    path: Schema.String,
  })
);

/** The requests that the fake backend served since the last reset, in order. */
let served: readonly ServedRequest[] = [];

/** The answer of a query that succeeds, with the value the function returns. */
export const answered =
  (value: unknown): Route =>
  () =>
    Promise.resolve(Response.json({ status: "success", value }));

/** A request that the network refuses with a code that a repeat may clear. */
export const unreachable: Route = () =>
  Promise.reject(
    new TypeError("fetch failed", {
      cause: Object.assign(new Error("connection reset"), {
        code: "ECONNRESET",
      }),
    })
  );

/** A request that never answers, so only a deadline ends it: a race of no promises never settles. */
export const silent: Route = () => Promise.race<Response>([]);

/** The session token route answers with the token. */
export const signedIn: Route = () =>
  Promise.resolve(Response.json({ token: TOKEN }));

/** The session token route refuses the request, which is final and does not retry. */
export const tokenRefused: Route = () =>
  Promise.resolve(new Response(null, { status: 403 }));

/** A route that the test does not name never answers, so a read it did not expect hangs and fails. */
const ABSENT: Record<ReadName, Route> = {
  profile: silent,
  refusal: silent,
  token: silent,
  viewer: silent,
};

/** Serves every request of one test from its routes, and records each request it serves. */
export function serve(routes: Partial<Record<ReadName, Route>>) {
  const named = { ...ABSENT, ...routes };
  fetcher.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname === TOKEN_PATH) {
      served = [...served, { auth: null, path: TOKEN_PATH, slug: undefined }];
      return named.token();
    }
    const { args, path } = Schema.decodeSync(QueryBody)(await request.text());
    served = [
      ...served,
      {
        auth: request.headers.get("authorization"),
        path,
        slug: args[0].slug,
      },
    ];
    if (path === PROFILE) {
      return named.profile();
    }
    return path === REFUSAL ? named.refusal() : named.viewer();
  });
}

/** Forgets the requests and the routes of the previous test. */
export function resetFakeBackend() {
  served = [];
  fetcher.mockReset();
}

/** The requests that the fake backend served to one path, in order. */
export function requestsTo(pathname: string) {
  return Arr.filter(served, (request) => request.path === pathname);
}

/** The school queries that the fake backend served, in order, with the token each carried. */
export function queriesOf() {
  return Arr.filter(served, (request) => request.path !== TOKEN_PATH);
}

/** A request to a school host, as a browser sends it: the Host header names the URL's host. */
export function visit(
  address: string,
  init?: { headers?: HeadersInit; method?: string }
) {
  const url = new URL(address);
  const headers = new Headers(init?.headers);
  headers.set("host", url.host);
  return new Request(url, { headers, method: init?.method ?? "GET" });
}

/** The answer of the refusal for one request, with the log messages it wrote. */
export const answerOf = Effect.fn("test.school.answerOf")(function* (
  address: string,
  init?: { headers?: HeadersInit; method?: string }
) {
  return yield* readSchoolRefusal(visit(address, init)).pipe(
    Effect.provide(Logger.layer([]))
  );
});

/** The answer of the refusal for one request, with the causes that it logged. */
export const answerAndCauses = Effect.fn("test.school.answerAndCauses")(
  function* (address: string, headers: HeadersInit) {
    const causes = MutableList.make<Cause.Cause<unknown>>();
    const answer = yield* readSchoolRefusal(visit(address, { headers })).pipe(
      Effect.provide(
        Logger.layer([
          Logger.make(({ cause }) => {
            MutableList.append(causes, cause);
          }),
        ])
      )
    );
    const logged = MutableList.toArray(causes);
    return {
      answer,
      count: logged.length,
      text: Arr.join(Arr.map(logged, Cause.pretty), "\n"),
    };
  }
);
