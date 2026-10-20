import { Effect } from "effect";
import { useQueryStates } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { useState } from "react";
import { ConvexIsland } from "@/components/providers/island";
import { useTryoutSetData } from "@/components/tryout/catalog/table/data";
import { TryoutSetFrame } from "@/components/tryout/catalog/table/frame";
import { catalogQuery } from "@/components/tryout/catalog/table/query";
import type {
  TryoutSetListArgs,
  TryoutSetPage,
  TryoutSetRequest,
  TryoutSetSelectionChange,
} from "@/components/tryout/catalog/table/types";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import {
  failVisitorSets,
  requestVisitorSets,
  settleVisitorSets,
  startVisitorSets,
  syncVisitorSets,
  VisitorSetReadError,
  visitorReadInput,
  visitorSetView,
  visitorWindowKey,
} from "@/components/tryout/catalog/table/visitor";
import { readTryoutTrackListFn } from "@/components/tryout/route/catalog.functions";

/** Props of the discovery table: its server payload and its title. */
export interface TryoutSetTableProps {
  /** Server-to-client payload: the list request and the result it resolved to. */
  bootstrap: {
    readonly args: TryoutSetListArgs;
    readonly result: TryoutSetPage;
  };
  title: string;
}

/**
 * Displays one complete discovery result with independent URL controls. A learner's
 * table reads the page's live query once its client exists. A visitor's table reads
 * the loader's first page, and each further window through the server function, so
 * no visitor opens a socket. The catalog table reads its filters from the URL, so
 * it mounts the adapter it reads through.
 */
export function TryoutSetTable(props: TryoutSetTableProps) {
  return (
    <NuqsAdapter>
      <TryoutSetCatalog {...props} />
    </NuqsAdapter>
  );
}

/** The props of both variants: the server payload, the request on screen, the selection setter and the title. */
interface VariantProps {
  bootstrap: TryoutSetTableProps["bootstrap"];
  request: TryoutSetRequest;
  select: (change: TryoutSetSelectionChange) => void;
  title: string;
}

function TryoutSetCatalog({ bootstrap, title }: TryoutSetTableProps) {
  const [selection, setSelection] = useQueryStates(catalogQuery, {
    history: "push",
    shallow: true,
    scroll: false,
  });
  const request: TryoutSetRequest = {
    countryKey: bootstrap.args.countryKey,
    examKey: bootstrap.args.examKey,
    filter: selection.status,
    locale: bootstrap.args.locale,
    sort: { direction: selection.direction, field: selection.sort },
    trackKey: bootstrap.args.trackKey,
  };
  const select = (change: TryoutSetSelectionChange) => setSelection(change);
  return (
    <ConvexIsland
      fallback={
        <TryoutSetVisitorCatalog
          bootstrap={bootstrap}
          request={request}
          select={select}
          title={title}
        />
      }
    >
      <TryoutSetSignedCatalog
        bootstrap={bootstrap}
        request={request}
        select={select}
        title={title}
      />
    </ConvexIsland>
  );
}

/** A learner's table: the page's live query, which starts from the loader's first page. */
function TryoutSetSignedCatalog({
  bootstrap,
  request,
  select,
  title,
}: VariantProps) {
  const data = useTryoutSetData({ bootstrap, request });
  return (
    <TryoutSetFrame
      data={data}
      filter={request.filter}
      onFilter={(filter) => select({ status: filter })}
      onSort={(sort) => select({ direction: sort.direction, sort: sort.field })}
      sort={request.sort}
      title={title}
    />
  );
}

/** Reads one window of a track for a visitor through the server function, at the server boundary. */
const readVisitorWindow = Effect.fn("www.tryout.catalog.readVisitorWindow")(
  function* (request: TryoutSetRequest, numItems: number) {
    return yield* Effect.tryPromise({
      try: () =>
        readTryoutTrackListFn({ data: visitorReadInput(request, numItems) }),
      catch: (cause) => new VisitorSetReadError({ cause }),
    });
  }
);

/**
 * A visitor's table. The loader's first page is the first rows, and a change of
 * filter, sort or window reads its own window. The pure state in `visitor.ts`
 * decides which response may commit.
 */
function TryoutSetVisitorCatalog({
  bootstrap,
  request,
  select,
  title,
}: VariantProps) {
  const [stored, setStored] = useState(() => startVisitorSets(bootstrap));
  const state = syncVisitorSets(stored, bootstrap);
  if (state !== stored) {
    setStored(state);
  }

  function load(next: TryoutSetRequest, numItems: number) {
    const key = visitorWindowKey(next, numItems);
    setStored((previous) =>
      requestVisitorSets(syncVisitorSets(previous, bootstrap), next, numItems)
    );
    Effect.runFork(
      readVisitorWindow(next, numItems).pipe(
        Effect.matchEffect({
          onFailure: () =>
            Effect.sync(() => {
              setStored((previous) => failVisitorSets(previous, key));
            }),
          onSuccess: (loaded) =>
            Effect.sync(() => {
              setStored((previous) =>
                settleVisitorSets(previous, key, loaded.result)
              );
            }),
        })
      )
    );
  }

  function changeSelection(change: TryoutSetSelectionChange) {
    select(change);
    load(
      {
        ...request,
        filter: change.status ?? request.filter,
        sort: {
          direction: change.direction ?? request.sort.direction,
          field: change.sort ?? request.sort.field,
        },
      },
      TRYOUT_SET_PAGE_SIZE
    );
  }

  const view = visitorSetView(state, request);
  return (
    <TryoutSetFrame
      data={{
        busy: view.busy,
        error: view.error,
        hasMore: view.hasMore,
        loadMore: () => load(request, view.nextSize),
        offline: view.offline,
        rows: view.rows,
        snapshotId: view.snapshotId,
      }}
      filter={request.filter}
      onFilter={(filter) => changeSelection({ status: filter })}
      onSort={(sort) =>
        changeSelection({ direction: sort.direction, sort: sort.field })
      }
      sort={request.sort}
      title={title}
    />
  );
}
