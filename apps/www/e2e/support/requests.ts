import type { Page, Request } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  Equal,
  MutableHashMap,
  Option,
  Result,
  Schema,
} from "effect";

export const TrackedRequestKindSchema = Schema.Literals([
  "javascript",
  "prefetch",
  "router",
]);

/** Matches the JavaScript chunks Next.js serves for the application. */
export const APP_SCRIPT_PATTERN = /\/_next\/static\/chunks\/.+\.js$/;

/** The header every request of the Next.js client router carries, with the value "1". */
export const NEXT_ROUTER_REQUEST_HEADER = "rsc";
export const NEXT_ROUTER_PREFETCH_HEADER = "next-router-prefetch";
export const NEXT_ROUTER_SEGMENT_PREFETCH_HEADER =
  "next-router-segment-prefetch";

export type TrackedRequestKind = typeof TrackedRequestKindSchema.Type;

export const RequestOutcomeSchema = Schema.Literals([
  "http",
  "missing-response",
  "network",
]);

export const TrackedRequestSchema = Schema.Struct({
  prefetchHeader: Schema.optional(Schema.String),
  segmentPrefetchHeader: Schema.optional(Schema.String),
  url: Schema.String,
});

export type TrackedRequest = typeof TrackedRequestSchema.Type;

export const requestFailureFields = {
  errorText: Schema.optional(Schema.String),
  outcome: RequestOutcomeSchema,
  prefetchHeader: Schema.optional(Schema.String),
  segmentPrefetchHeader: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Finite),
  url: Schema.String,
};

export const RequestFailureSchema = Schema.Struct(requestFailureFields);

export type RequestFailure = typeof RequestFailureSchema.Type;

export const formatRequestFailure = (failure: RequestFailure) => {
  const prefetchHeader =
    failure.prefetchHeader === undefined
      ? ""
      : ` prefetchHeader=${failure.prefetchHeader}`;
  const segmentPrefetchHeader =
    failure.segmentPrefetchHeader === undefined
      ? ""
      : ` segmentPrefetchHeader=${failure.segmentPrefetchHeader}`;
  const status =
    failure.status === undefined ? "" : ` status=${failure.status}`;
  const errorText =
    failure.errorText === undefined ? "" : ` errorText=${failure.errorText}`;
  return `outcome=${failure.outcome} url=${failure.url}${prefetchHeader}${segmentPrefetchHeader}${status}${errorText}`;
};

type RequestClassifier = (request: Request) => TrackedRequestKind | undefined;

const PendingRequestSchema = Schema.Struct({
  details: TrackedRequestSchema,
  kind: TrackedRequestKindSchema,
});

type PendingRequest = typeof PendingRequestSchema.Type;

const readTrackedRequest = (request: Request): TrackedRequest => {
  const headers = request.headers();
  const prefetchHeader = headers[NEXT_ROUTER_PREFETCH_HEADER];
  const segmentPrefetchHeader = headers[NEXT_ROUTER_SEGMENT_PREFETCH_HEADER];

  return {
    ...(prefetchHeader === undefined ? {} : { prefetchHeader }),
    ...(segmentPrefetchHeader === undefined ? {} : { segmentPrefetchHeader }),
    url: request.url(),
  };
};

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
