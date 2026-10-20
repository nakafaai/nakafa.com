import { Array as Arr } from "effect";

/**
 * A visitor's profile list. The loader's first page starts it, and each next page
 * is read by its cursor through the server. Only one read is in flight, and a page
 * that arrives while none is pending changes nothing.
 */
interface VisitorListState<Item> {
  readonly cursor: string;
  readonly failed: boolean;
  readonly isDone: boolean;
  readonly pending: boolean;
  readonly rows: readonly Item[];
}

/** One page of a profile list as the server reads it. */
export interface VisitorListPage<Item> {
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly page: readonly Item[];
}

/** Starts a visitor's list from the loader's first page, or from a failed read when the server could not read one. */
export function startVisitorList<Item>(
  first: VisitorListPage<Item> | undefined
): VisitorListState<Item> {
  if (first === undefined) {
    return { cursor: "", failed: true, isDone: true, pending: false, rows: [] };
  }
  return {
    cursor: first.continueCursor,
    failed: false,
    isDone: first.isDone,
    pending: false,
    rows: first.page,
  };
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

/** The state the rows view shows for a visitor's list. */
export function visitorListView<Item>(state: VisitorListState<Item>) {
  return {
    empty: state.isDone && !state.failed && state.rows.length === 0,
    failed: state.failed,
    ready: true,
    rows: state.rows,
  };
}
