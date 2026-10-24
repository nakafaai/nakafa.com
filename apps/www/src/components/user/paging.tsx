import { Effect } from "effect";
import { useState } from "react";
import {
  readVisitorPage,
  requestNextVisitorPage,
  startVisitorList,
  syncVisitorList,
  type VisitorListPage,
} from "@/components/user/visitor";

/**
 * A visitor's profile list. The loader's first page starts it, and `loadMore`
 * reads the next page by its cursor through the server. A new first page from the
 * loader starts the list again, which is how a Retry shows a failed first read. A
 * new profile remounts the list, so a list never shows another profile's rows.
 */
export function useVisitorList<Item>({
  first,
  readPage,
}: {
  first: VisitorListPage<Item> | undefined;
  readPage: (cursor: string) => Promise<VisitorListPage<Item>>;
}) {
  const [stored, setStored] = useState(() => startVisitorList(first));
  const list = syncVisitorList(stored, first);
  if (list !== stored) {
    setStored(list);
  }

  /** Reads the next page below the rows, unless a read is pending or the list is done. */
  function loadMore() {
    if (list.isDone || list.pending) {
      return;
    }
    setStored((previous) => requestNextVisitorPage(previous));
    Effect.runFork(
      readVisitorPage({ commit: setStored, cursor: list.cursor, readPage })
    );
  }

  return { list, loadMore };
}
