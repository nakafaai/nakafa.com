import type { Page, Request } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  Equal,
  MutableHashMap,
  MutableList,
  Option,
  Result,
  Schema,
} from "effect";

const TrackedRequestKindSchema = Schema.Literals(["data", "javascript"]);

/** Matches the JavaScript chunks that the Vite build writes under `/assets/`. */
export const APP_SCRIPT_PATTERN = /\/assets\/.+\.js$/;

/**
 * The header that the TanStack client router sends with every server function
 * call, with the value "true". The loader data of a navigation and of an intent
 * preload both travel as server function calls, so a request with this header
 * is the page's data.
 */
export const SERVER_FUNCTION_HEADER = "x-tsr-serverfn";

/** The path that the server function calls of the application start with. */
export const SERVER_FUNCTION_PATH = "/_serverFn/";

/**
 * Records the URL of every server function call that a page makes, in order.
 * A call that started before a point can be counted from the length of the list.
 */
export function recordServerFunctionCalls(page: Page) {
  const calls = MutableList.make<string>();
  page.on("request", (request) => {
    if (request.headers()[SERVER_FUNCTION_HEADER] === "true") {
      MutableList.append(calls, request.url());
    }
  });
  return calls;
}

export type TrackedRequestKind = typeof TrackedRequestKindSchema.Type;

const RequestOutcomeSchema = Schema.Literals([
  "http",
  "missing-response",
  "network",
]);

const TrackedRequestSchema = Schema.Struct({
  url: Schema.String,
});

type TrackedRequest = typeof TrackedRequestSchema.Type;

export const requestFailureFields = {
  errorText: Schema.optional(Schema.String),
  outcome: RequestOutcomeSchema,
  status: Schema.optional(Schema.Finite),
  url: Schema.String,
};

export const RequestFailureSchema = Schema.Struct(requestFailureFields);

type RequestFailure = typeof RequestFailureSchema.Type;

export const formatRequestFailure = (failure: RequestFailure) => {
  const status =
    failure.status === undefined ? "" : ` status=${failure.status}`;
  const errorText =
    failure.errorText === undefined ? "" : ` errorText=${failure.errorText}`;
  return `outcome=${failure.outcome} url=${failure.url}${status}${errorText}`;
};

type RequestClassifier = (request: Request) => TrackedRequestKind | undefined;

const PendingRequestSchema = Schema.Struct({
  details: TrackedRequestSchema,
  kind: TrackedRequestKindSchema,
});

type PendingRequest = typeof PendingRequestSchema.Type;

const readTrackedRequest = (request: Request): TrackedRequest => ({
  url: request.url(),
});

/**
 * Starts listening to one page's requests and returns the tracker that reads
 * them, with the handlers that stop the listening.
 */
const openRequestTracker = Effect.fn("NakafaE2E.openRequestTracker")(
  (page: Page, classifyRequest: RequestClassifier) =>
    Effect.sync(() => {
      const failures = MutableHashMap.empty<
        TrackedRequestKind,
        RequestFailure
      >();
      // Playwright passes one Request object to every event of that request,
      // so the object itself is the key. Effect hashes and compares an unmarked
      // object by its structure, which would walk Playwright's object graph.
      // Each Request is marked for reference equality before the map reads or
      // stores it, so it matches only itself, as a native Map would. The mark
      // stays on that object for good and changes nothing else about it.
      const pendingRequests = MutableHashMap.empty<Request, PendingRequest>();
      const successfulCounts = MutableHashMap.empty<
        TrackedRequestKind,
        number
      >();
      let revision = 0;

      const countSuccessful = (kind: TrackedRequestKind) =>
        Option.getOrElse(MutableHashMap.get(successfulCounts, kind), () => 0);
      const handleRequest = (request: Request) => {
        const requestKind = classifyRequest(request);
        if (!requestKind) {
          return;
        }
        Equal.byReferenceUnsafe(request);
        MutableHashMap.set(pendingRequests, request, {
          details: readTrackedRequest(request),
          kind: requestKind,
        });
        revision += 1;
      };
      const settleRequest = (request: Request) => {
        Equal.byReferenceUnsafe(request);
        const pendingRequest = Option.getOrUndefined(
          MutableHashMap.get(pendingRequests, request)
        );
        if (!pendingRequest) {
          return;
        }
        MutableHashMap.remove(pendingRequests, request);
        revision += 1;
        return pendingRequest;
      };
      const recordFailure = (
        pendingRequest: PendingRequest,
        requestFailure: RequestFailure
      ) => {
        if (!MutableHashMap.has(failures, pendingRequest.kind)) {
          MutableHashMap.set(failures, pendingRequest.kind, requestFailure);
        }
      };
      const handleRequestFailed = (request: Request) => {
        const pendingRequest = settleRequest(request);
        if (!pendingRequest) {
          return;
        }
        const requestFailure = request.failure();
        recordFailure(
          pendingRequest,
          requestFailure
            ? {
                ...pendingRequest.details,
                errorText: requestFailure.errorText,
                outcome: "network",
              }
            : {
                ...pendingRequest.details,
                outcome: "network",
              }
        );
      };
      const handleRequestFinished = (request: Request) => {
        const pendingRequest = settleRequest(request);
        if (!pendingRequest) {
          return;
        }
        const response = request.existingResponse();
        if (!response) {
          recordFailure(pendingRequest, {
            ...pendingRequest.details,
            outcome: "missing-response",
          });
          return;
        }
        if (!response.ok()) {
          recordFailure(pendingRequest, {
            ...pendingRequest.details,
            outcome: "http",
            status: response.status(),
          });
          return;
        }
        MutableHashMap.set(
          successfulCounts,
          pendingRequest.kind,
          countSuccessful(pendingRequest.kind) + 1
        );
      };

      /**
       * Playwright reports network failures through `requestfailed`, while
       * HTTP error responses still finish through `requestfinished`.
       *
       * @see https://playwright.dev/docs/api/class-page#page-event-request-failed
       * @see https://playwright.dev/docs/api/class-page#page-event-request-finished
       */
      page.on("request", handleRequest);
      page.on("requestfailed", handleRequestFailed);
      page.on("requestfinished", handleRequestFinished);

      return {
        handleRequest,
        handleRequestFailed,
        handleRequestFinished,
        tracker: {
          getFailure(kind: TrackedRequestKind) {
            return Option.getOrUndefined(MutableHashMap.get(failures, kind));
          },
          pendingRequests(kind: TrackedRequestKind) {
            return Arr.filterMap(
              MutableHashMap.values(pendingRequests),
              (request) =>
                request.kind === kind
                  ? Result.succeed(request.details)
                  : Result.failVoid
            );
          },
          get pendingCount() {
            return MutableHashMap.size(pendingRequests);
          },
          get revision() {
            return revision;
          },
          successfulCount: countSuccessful,
        },
      };
    })
);

/** The live view a suite reads while its page's requests settle. */
export type RequestTracker = Effect.Success<
  ReturnType<typeof openRequestTracker>
>["tracker"];

/** Owns one classified Playwright request lifecycle and its truthful outcome. */
export const withRequestTracker = Effect.fn("NakafaE2E.withRequestTracker")(
  function* <A, E, R>(
    page: Page,
    classifyRequest: RequestClassifier,
    use: (tracker: RequestTracker) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      openRequestTracker(page, classifyRequest),
      ({ tracker }) => use(tracker),
      ({ handleRequest, handleRequestFailed, handleRequestFinished }) =>
        Effect.sync(() => {
          page.off("request", handleRequest);
          page.off("requestfailed", handleRequestFailed);
          page.off("requestfinished", handleRequestFinished);
        })
    );
  }
);
