import type { Page, Request } from "@playwright/test";
import { Effect, Schema } from "effect";

export const TrackedRequestKindSchema = Schema.Literals([
  "javascript",
  "prefetch",
]);

export type TrackedRequestKind = Schema.Schema.Type<
  typeof TrackedRequestKindSchema
>;

export const RequestFailureKindSchema = Schema.Literals([
  "http",
  "missing-response",
  "network",
]);

export const RequestFailureSchema = Schema.Struct({
  errorText: Schema.optional(Schema.String),
  kind: RequestFailureKindSchema,
  status: Schema.optional(Schema.Finite),
  url: Schema.String,
});

export type RequestFailure = Schema.Schema.Type<typeof RequestFailureSchema>;

export interface RequestTracker {
  readonly getFailure: () => RequestFailure | undefined;
  readonly hasObserved: (kind: TrackedRequestKind) => boolean;
  readonly pendingCount: number;
  readonly reset: () => void;
  readonly revision: number;
  readonly successfulCount: (kind: TrackedRequestKind) => number;
}

type RequestClassifier = (request: Request) => TrackedRequestKind | undefined;

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
        const pendingRequests = new Map<Request, TrackedRequestKind>();
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
          pendingRequests.set(request, requestKind);
          revision += 1;
        };
        const settleRequest = (request: Request) => {
          const requestKind = pendingRequests.get(request);
          if (!requestKind) {
            return;
          }
          pendingRequests.delete(request);
          revision += 1;
          return requestKind;
        };
        const handleRequestFailed = (request: Request) => {
          if (!settleRequest(request)) {
            return;
          }
          const requestFailure = request.failure();
          failure ??= requestFailure
            ? {
                errorText: requestFailure.errorText,
                kind: "network",
                url: request.url(),
              }
            : { kind: "network", url: request.url() };
        };
        const handleRequestFinished = (request: Request) => {
          const requestKind = settleRequest(request);
          if (!requestKind) {
            return;
          }
          const response = request.existingResponse();
          if (!response) {
            failure ??= {
              kind: "missing-response",
              url: request.url(),
            };
            return;
          }
          if (!response.ok()) {
            failure ??= {
              kind: "http",
              status: response.status(),
              url: request.url(),
            };
            return;
          }
          successfulCounts.set(
            requestKind,
            (successfulCounts.get(requestKind) ?? 0) + 1
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
