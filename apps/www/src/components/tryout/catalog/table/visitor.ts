import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/tryout/limits";
import {
  listArgsValidator,
  trackSetPageValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { Effect, Option, Schema } from "effect";
import {
  requestKey,
  selectionKey,
} from "@/components/tryout/catalog/table/keys";
import type {
  TryoutSetPage,
  TryoutSetRequest,
} from "@/components/tryout/catalog/table/types";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";

/** A visitor's set list could not be read, so the table keeps its last complete rows and reports it. */
export class VisitorSetReadError extends Schema.TaggedError<VisitorSetReadError>()(
  "VisitorSetReadError",
  { cause: Schema.Unknown }
) {}

/** The loader's first page of a track: the request it answers and its rows. */
const VisitorSetBootstrap = Schema.Struct({
  args: listArgsValidator,
  result: trackSetPageValidator,
});

/**
 * A visitor's set list. The loader's first page is the committed page. Each other
 * window is read by the server function, and only the request the state last
 * started may commit: a response for an older request is dropped.
 */
const VisitorSetState = Schema.Struct({
  /** The request of the bootstrap this state was built from, so a new loader result rebuilds it. */
  bootstrapKey: Schema.String,
  committed: Schema.Struct({
    key: Schema.String,
    page: trackSetPageValidator,
  }),
  failedKey: Schema.Option(Schema.String),
  pendingKey: Schema.Option(Schema.String),
  /** The selection the window belongs to, and the rows it reads for that selection. */
  window: Schema.Struct({
    selection: Schema.String,
    size: Schema.Finite,
  }),
});
type VisitorSetBootstrap = typeof VisitorSetBootstrap.Type;
type VisitorSetState = typeof VisitorSetState.Type;

/** The arguments of the server function that reads one window of a track for a visitor. */
export function visitorReadInput(request: TryoutSetRequest, numItems: number) {
  return {
    locale: request.locale,
    numItems,
    search: {
      direction: request.sort.direction,
      sort: request.sort.field,
      status: request.filter,
    },
    track: {
      countryKey: request.countryKey,
      examKey: request.examKey,
      trackKey: request.trackKey,
    },
  };
}

/** Identifies the request of one window, so a read can name the response it returns. */
export function visitorWindowKey(request: TryoutSetRequest, numItems: number) {
  return requestKey({
    ...request,
    paginationOpts: { cursor: null, numItems },
  });
}

/** Starts a visitor's set list in the state of the loader's first page. */
export function startVisitorSets(
  bootstrap: VisitorSetBootstrap
): VisitorSetState {
  const key = requestKey(bootstrap.args);
  return {
    bootstrapKey: key,
    committed: { key, page: bootstrap.result },
    failedKey: Option.none(),
    pendingKey: Option.none(),
    window: {
      selection: selectionKey(bootstrap.args),
      size: bootstrap.args.paginationOpts.numItems,
    },
  };
}

/** Rebuilds the state when the loader returns another first page, such as after a route change. */
export function syncVisitorSets(
  state: VisitorSetState,
  bootstrap: VisitorSetBootstrap
): VisitorSetState {
  if (state.bootstrapKey === requestKey(bootstrap.args)) {
    return state;
  }
  return startVisitorSets(bootstrap);
}

/** The number of rows the request reads: a new selection starts again at the first page. */
function readWindowSize(state: VisitorSetState, request: TryoutSetRequest) {
  return state.window.selection === selectionKey(request)
    ? state.window.size
    : TRYOUT_SET_PAGE_SIZE;
}

/** Makes a read of one window the one the state waits for. */
export function requestVisitorSets(
  state: VisitorSetState,
  request: TryoutSetRequest,
  numItems: number
): VisitorSetState {
  return {
    ...state,
    failedKey: Option.none(),
    pendingKey: Option.some(visitorWindowKey(request, numItems)),
    window: { selection: selectionKey(request), size: numItems },
  };
}

/** Whether the read with this key is the one the state waits for. */
function isPendingRead(state: VisitorSetState, key: string) {
  return Option.exists(state.pendingKey, (pending) => pending === key);
}

/** Commits the page of a read, unless a later request has replaced it. */
export function settleVisitorSets(
  state: VisitorSetState,
  key: string,
  page: TryoutSetPage
): VisitorSetState {
  if (!isPendingRead(state, key)) {
    return state;
  }
  return {
    ...state,
    committed: { key, page },
    pendingKey: Option.none(),
  };
}

/** Records a failed read, unless a later request has replaced it. */
export function failVisitorSets(
  state: VisitorSetState,
  key: string
): VisitorSetState {
  if (!isPendingRead(state, key)) {
    return state;
  }
  return { ...state, failedKey: Option.some(key), pendingKey: Option.none() };
}

/**
 * Reads one window through `read` and commits its outcome for `key`: the page when
 * the read returns, the failure when it fails. A response for a request that a later
 * one replaced changes nothing.
 */
export function commitVisitorWindow<E>({
  commit,
  key,
  read,
}: {
  readonly commit: (
    update: (state: VisitorSetState) => VisitorSetState
  ) => void;
  readonly key: string;
  readonly read: Effect.Effect<Pick<VisitorSetBootstrap, "result">, E>;
}) {
  return read.pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.sync(() => {
          commit((previous) => failVisitorSets(previous, key));
        }),
      onSuccess: (loaded) =>
        Effect.sync(() => {
          commit((previous) => settleVisitorSets(previous, key, loaded.result));
        }),
    })
  );
}

/**
 * The table's view of a visitor's set list for the request on screen. The next
 * window is the one that loading more reads, capped at the catalog limit.
 */
export function visitorSetView(
  state: VisitorSetState,
  request: TryoutSetRequest
) {
  const size = readWindowSize(state, request);
  return {
    busy: Option.isSome(state.pendingKey),
    error: Option.exists(
      state.failedKey,
      (failed) => failed === visitorWindowKey(request, size)
    ),
    hasMore: !state.committed.page.isDone && size < TRYOUT_CATALOG_LIMIT,
    nextSize: Math.min(size + TRYOUT_SET_PAGE_SIZE, TRYOUT_CATALOG_LIMIT),
    offline: false,
    rows: state.committed.page.page,
    snapshotId: state.committed.page.snapshotId,
  };
}
