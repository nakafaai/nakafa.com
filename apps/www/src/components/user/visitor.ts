import { Array as Arr, Effect, Schema } from "effect";

/**
 * A visitor's profile list. The loader's first page starts it, and each next page
 * is read by its cursor through the server. Only one read is in flight, and a page
 * that arrives while none is pending changes nothing. The state keeps the first
 * page it started from, so a new first page from the loader starts the list again.
 */
export interface VisitorListState<Item> {
  readonly cursor: string;
  readonly failed: boolean;
  readonly isDone: boolean;
  readonly pending: boolean;
  readonly rows: readonly Item[];
  readonly source: VisitorListPage<Item> | undefined;
}

/** One page of a profile list as the server reads it. */
export interface VisitorListPage<Item> {
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly page: readonly Item[];
}

/** A visitor's next page could not be read, so the list shows the failure above its rows. */
class VisitorPageReadError extends Schema.TaggedError<VisitorPageReadError>()(
  "VisitorPageReadError",
  { cause: Schema.Unknown }
) {}

/** Starts a visitor's list from the loader's first page, or from a failed read when the server could not read one. */
export function startVisitorList<Item>(
  first: VisitorListPage<Item> | undefined
): VisitorListState<Item> {
  if (first === undefined) {
    return {
      cursor: "",
      failed: true,
      isDone: true,
      pending: false,
      rows: [],
      source: first,
    };
  }
  return {
    cursor: first.continueCursor,
    failed: false,
    isDone: first.isDone,
    pending: false,
    rows: first.page,
    source: first,
  };
}

/**
 * Rebuilds the list when the loader hands over another first page, such as after a
 * Retry of a failed first read. The same first page keeps the list as it is.
 */
export function syncVisitorList<Item>(
  state: VisitorListState<Item>,
  first: VisitorListPage<Item> | undefined
): VisitorListState<Item> {
  if (state.source === first) {
    return state;
  }
  return startVisitorList(first);
}

/** Marks the next page as read, unless the list has no next page or a read is pending. */
export function requestNextVisitorPage<Item>(
  state: VisitorListState<Item>
): VisitorListState<Item> {
  if (state.isDone || state.pending) {
    return state;
  }
  return { ...state, failed: false, pending: true };
}

/** Appends the page a read returned, when the list was waiting for one. */
export function appendVisitorPage<Item>(
  state: VisitorListState<Item>,
  next: VisitorListPage<Item>
): VisitorListState<Item> {
  if (!state.pending) {
    return state;
  }
  return {
    cursor: next.continueCursor,
    failed: false,
    isDone: next.isDone,
    pending: false,
    rows: Arr.appendAll(state.rows, next.page),
    source: state.source,
  };
}

/** Records a failed read of the next page, when the list was waiting for one. */
export function failNextVisitorPage<Item>(
  state: VisitorListState<Item>
): VisitorListState<Item> {
  if (!state.pending) {
    return state;
  }
  return { ...state, failed: true, pending: false };
}

/**
 * Reads the page after `cursor` through the server and commits its outcome to the
 * list: the page when it arrives, or the failure when the read fails. The commit
 * receives each change as a function of the list it is applied to.
 */
export function readVisitorPage<Item>({
  commit,
  cursor,
  readPage,
}: {
  readonly commit: (
    update: (state: VisitorListState<Item>) => VisitorListState<Item>
  ) => void;
  readonly cursor: string;
  readonly readPage: (cursor: string) => Promise<VisitorListPage<Item>>;
}) {
  return Effect.tryPromise({
    try: () => readPage(cursor),
    catch: (cause) => new VisitorPageReadError({ cause }),
  }).pipe(
    Effect.matchEffect({
      onFailure: () =>
        Effect.sync(() => {
          commit(failNextVisitorPage);
        }),
      onSuccess: (next) =>
        Effect.sync(() => {
          commit((previous) => appendVisitorPage(previous, next));
        }),
    })
  );
}

/** The state the rows view shows for a visitor's list. */
export function visitorListView<Item>(state: VisitorListState<Item>) {
  return {
    empty: state.isDone && !state.failed && state.rows.length === 0,
    failed: state.failed,
    ready: true,
    rows: state.rows,
  };
}
