import type { Page, Request } from "@playwright/test";
import { Effect, Schema } from "effect";

export const TrackedRequestKindSchema = Schema.Literals([
  "javascript",
  "prefetch",
]);

export const NEXT_ROUTER_PREFETCH_HEADER = "next-router-prefetch";
export const NEXT_ROUTER_SEGMENT_PREFETCH_HEADER =
  "next-router-segment-prefetch";

export type TrackedRequestKind = Schema.Schema.Type<
  typeof TrackedRequestKindSchema
>;

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

export type TrackedRequest = Schema.Schema.Type<typeof TrackedRequestSchema>;

export const requestFailureFields = {
  errorText: Schema.optional(Schema.String),
  outcome: RequestOutcomeSchema,
  prefetchHeader: Schema.optional(Schema.String),
  segmentPrefetchHeader: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Finite),
  url: Schema.String,
};

export const RequestFailureSchema = Schema.Struct(requestFailureFields);

export type RequestFailure = Schema.Schema.Type<typeof RequestFailureSchema>;

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

export interface RequestTracker {
  readonly getFailure: () => RequestFailure | undefined;
  readonly hasObserved: (kind: TrackedRequestKind) => boolean;
  readonly pendingCount: number;
  readonly pendingRequests: (
    kind: TrackedRequestKind
  ) => readonly TrackedRequest[];
  readonly reset: () => void;
  readonly revision: number;
  readonly successfulCount: (kind: TrackedRequestKind) => number;
}

type RequestClassifier = (request: Request) => TrackedRequestKind | undefined;

interface PendingRequest {
  readonly details: TrackedRequest;
  readonly kind: TrackedRequestKind;
}

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

/** Owns one classified Playwright request lifecycle and its truthful outcome. */
export const withRequestTracker = Effect.fn("NakafaE2E.withRequestTracker")(
  function* <A, E, R>(
    page: Page,
    classifyRequest: RequestClassifier,
    use: (tracker: RequestTracker) => Effect.Effect<A, E, R>
  ) {
    return yield* Effect.acquireUseRelease(
      Effect.sync(() => {
        const observedKinds = new Set<TrackedRequestKind>();
        const pendingRequests = new Map<Request, PendingRequest>();
        const successfulCounts = new Map<TrackedRequestKind, number>();
        let failure: RequestFailure | undefined;
        let revision = 0;

        const reset = () => {
          failure = undefined;
          observedKinds.clear();
          pendingRequests.clear();
          successfulCounts.clear();
          revision += 1;
        };
        const handleRequest = (request: Request) => {
          const requestKind = classifyRequest(request);
          if (!requestKind) {
            return;
          }
          observedKinds.add(requestKind);
          pendingRequests.set(request, {
            details: readTrackedRequest(request),
            kind: requestKind,
          });
          revision += 1;
        };
        const settleRequest = (request: Request) => {
          const pendingRequest = pendingRequests.get(request);
          if (!pendingRequest) {
            return;
          }
          pendingRequests.delete(request);
          revision += 1;
          return pendingRequest;
        };
        const handleRequestFailed = (request: Request) => {
          const pendingRequest = settleRequest(request);
          if (!pendingRequest) {
            return;
          }
          const requestFailure = request.failure();
          failure ??= requestFailure
            ? {
                ...pendingRequest.details,
                errorText: requestFailure.errorText,
                outcome: "network",
              }
            : {
                ...pendingRequest.details,
                outcome: "network",
              };
        };
        const handleRequestFinished = (request: Request) => {
          const pendingRequest = settleRequest(request);
          if (!pendingRequest) {
            return;
          }
          const response = request.existingResponse();
          if (!response) {
            failure ??= {
              ...pendingRequest.details,
              outcome: "missing-response",
            };
            return;
          }
          if (!response.ok()) {
            failure ??= {
              ...pendingRequest.details,
              outcome: "http",
              status: response.status(),
            };
            return;
          }
          successfulCounts.set(
            pendingRequest.kind,
            (successfulCounts.get(pendingRequest.kind) ?? 0) + 1
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
            getFailure() {
              return failure;
            },
            hasObserved(kind: TrackedRequestKind) {
              return observedKinds.has(kind);
            },
            pendingRequests(kind: TrackedRequestKind) {
              return Array.from(pendingRequests.values())
                .filter((request) => request.kind === kind)
                .map((request) => request.details);
            },
            get pendingCount() {
              return pendingRequests.size;
            },
            reset,
            get revision() {
              return revision;
            },
            successfulCount(kind: TrackedRequestKind) {
              return successfulCounts.get(kind) ?? 0;
            },
          },
        };
      }),
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
