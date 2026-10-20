import { Effect, Schema } from "effect";
import { useState } from "react";
import {
  appendVisitorPage,
  failNextVisitorPage,
  requestNextVisitorPage,
  startVisitorList,
  type VisitorListPage,
} from "@/components/user/visitor";

/** A visitor's next page could not be read, so the list shows the failure above its rows. */
class VisitorPageReadError extends Schema.TaggedError<VisitorPageReadError>()(
  "VisitorPageReadError",
  { cause: Schema.Unknown }
) {}

/**
 * A visitor's profile list. The loader's first page starts it, and `loadMore`
 * reads the next page by its cursor through the server. A new profile remounts
 * the list, so a list never shows another profile's rows.
 */
export function useVisitorList<Item>({
  first,
  readPage,
}: {
  first: VisitorListPage<Item> | undefined;
  readPage: (cursor: string) => Promise<VisitorListPage<Item>>;
}) {
  const [list, setList] = useState(() => startVisitorList(first));

  /** Reads the next page below the rows, unless a read is pending or the list is done. */
  function loadMore() {
    if (list.isDone || list.pending) {
      return;
    }
    const { cursor } = list;
    setList((previous) => requestNextVisitorPage(previous));
    Effect.runFork(
      Effect.tryPromise({
        try: () => readPage(cursor),
        catch: (cause) => new VisitorPageReadError({ cause }),
      }).pipe(
        Effect.matchEffect({
          onFailure: () =>
            Effect.sync(() => {
              setList((previous) => failNextVisitorPage(previous));
            }),
          onSuccess: (next) =>
            Effect.sync(() => {
              setList((previous) => appendVisitorPage(previous, next));
            }),
        })
      )
    );
  }

  return { list, loadMore };
}
