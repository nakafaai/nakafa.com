import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Delete02Icon,
  Image01Icon,
  Link04Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { ClassHeader } from "@/components/tenant/classes/header";
import { AddToLibrary } from "@/components/tenant/classes/library/create";
import {
  type LibraryItem,
  removeItemUpdate,
} from "@/components/tenant/classes/library/optimistic";
import { useLibraryUploads } from "@/components/tenant/classes/library/scope";
import {
  arrivedUploads,
  type LibraryUpload,
  pendingUploads,
} from "@/components/tenant/classes/library/uploads";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many items the library reads each time its end comes into view. */
const LIBRARY_PAGE_SIZE = 20;

/** The icon of each kind of item. */
const KIND_ICONS = {
  image: Image01Icon,
  link: Link04Icon,
  pdf: Pdf02Icon,
};

/** A saved item of the library as a row of its table. */
const itemRow = (item: LibraryItem) => ({ _tag: "item" as const, item });

/** A file the teacher is adding, as a row of the library's table until its own row arrives. */
const uploadRow = (upload: LibraryUpload) => ({
  _tag: "upload" as const,
  upload,
});

/** One row of the library's table. */
type LibraryRow = ReturnType<typeof itemRow> | ReturnType<typeof uploadRow>;

/** The fields every row shows: a saved item's, or those of a file being added. */
const shownOf = (row: LibraryRow) =>
  row._tag === "item" ? row.item : row.upload;

/** The columns of the library's table. */
const libraryColumns = createColumnHelper<
  typeof dataTableFeatures,
  LibraryRow
>();

/**
 * The library of a class: the class header with the search over the items' titles and Add to
 * library for its teachers, and the items, the newest first, in the page's one table card. The
 * files the teacher is adding show first from the moment the dialog closes, until their own rows
 * arrive. A class with no item shows the empty state without a search, a failed read its sentence
 * and Try again, and a viewer who lost the school's access is sent to the refused page.
 */
export function LibraryList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const uploads = useStore(useLibraryUploads(), (state) => state.uploads);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const pagination = usePaginatedQuery(
    classroom.library.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: LIBRARY_PAGE_SIZE }
  );
  const items = PaginatedQueryResult.isFailure(pagination)
    ? []
    : pagination.results;
  // An upload whose row arrived is remembered while rendering, as React keeps state from the
  // previous render, so its row never shows twice and never comes back.
  const arrived = arrivedUploads(uploads, items, seen);
  if (Arr.isReadonlyArrayNonEmpty(arrived)) {
    setSeen(Arr.appendAll(seen, arrived));
  }
  const pending = pendingUploads(uploads, items, seen);

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const loadingFirst = pagination._tag === "LoadingFirstPage";
  const failed = PaginatedQueryResult.isFailure(pagination);
  const empty =
    !(loadingFirst || failed) &&
    Arr.isReadonlyArrayEmpty(items) &&
    Arr.isReadonlyArrayEmpty(pending);

  return (
    <TableFiltersProvider>
      <ClassHeader>
        {empty ? null : <TableSearch placeholder={t("library-search")} />}
        {Arr.contains(can, "library.manage") ? <AddToLibrary /> : null}
      </ClassHeader>
      <TablePageBody>
        {empty ? (
          <TableEmpty
            act="reading"
            description={t("library-empty-description")}
            title={t("library-empty")}
          />
        ) : (
          <LibraryRows
            failed={failed}
            items={items}
            loadingFirst={loadingFirst}
            pending={pending}
          />
        )}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection
            onIntersect={() => pagination.loadMore(LIBRARY_PAGE_SIZE)}
          />
        ) : null}
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/**
 * The rows of the library: each item's title, which opens it in a new tab, who added it, and when,
 * with the files being added first, in a data table, or nothing while the first page loads. A
 * teacher removes an item from its row's menu. A failed read shows its sentence and Try again in
 * the table's place.
 */
function LibraryRows({
  failed,
  items,
  loadingFirst,
  pending,
}: {
  failed: boolean;
  items: readonly LibraryItem[];
  loadingFirst: boolean;
  pending: readonly LibraryUpload[];
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const { can } = useClassScope();

  if (failed) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (loadingFirst) {
    return null;
  }
  const rows: readonly LibraryRow[] = Arr.appendAll(
    Arr.map(pending, uploadRow),
    Arr.map(items, itemRow)
  );
  const columns = libraryColumns.columns([
    libraryColumns.accessor((row) => shownOf(row).title, {
      cell: (info) => <LibraryTitle row={info.row.original} />,
      enableSorting: false,
      filterFn: "includesString",
      header: t("library-title"),
      id: "title",
    }),
    libraryColumns.accessor((row) => shownOf(row).author, {
      cell: (info) => (
        <span className="text-muted-foreground" dir="auto">
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
      header: t("library-added-by"),
      id: "author",
    }),
    libraryColumns.accessor((row) => shownOf(row).createdAt, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      enableSorting: false,
      header: t("library-added"),
      id: "added",
    }),
    ...(Arr.contains(can, "library.manage")
      ? [
          libraryColumns.display({
            cell: (info) =>
              info.row.original._tag === "item" ? (
                <LibraryRemove item={info.row.original.item} />
              ) : null,
            header: "",
            id: "actions",
            meta: { align: "menu" },
          }),
        ]
      : []),
  ]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowId={(row) =>
        row._tag === "item" ? row.item.id : row.upload.clientKey
      }
      search="title"
    />
  );
}

/**
 * An item's kind and title: a saved item with an address opens it in a new tab, and a file being
 * added shows its title without a link until the server keeps it.
 */
function LibraryTitle({ row }: { row: LibraryRow }) {
  const t = useTranslations("Classroom");
  const shown = shownOf(row);
  const address = row._tag === "item" ? row.item.address : null;

  return (
    <span className="flex items-center gap-2 font-medium">
      <HugeIcons
        aria-label={t(`library-kind-${shown.kind}`)}
        className="shrink-0 text-muted-foreground"
        icon={KIND_ICONS[shown.kind]}
      />
      {address === null ? (
        <span dir="auto">{shown.title}</span>
      ) : (
        <a
          className="underline-offset-4 hover:underline"
          dir="auto"
          href={address}
          rel="noopener noreferrer"
          target="_blank"
        >
          {shown.title}
        </a>
      )}
    </span>
  );
}

/** The menu of a saved item for a teacher: Remove, which asks first and takes the row away at once. */
function LibraryRemove({ item }: { item: LibraryItem }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const remove = useMutation(classroom.library.remove);

  return (
    <ConfirmRowMenu
      action={t("library-remove")}
      confirm={t("library-remove")}
      description={t("library-remove-description")}
      icon={Delete02Icon}
      onConfirm={() =>
        runForumCall(
          forumCall(() =>
            remove.withOptimisticUpdate(removeItemUpdate)({
              classId,
              itemId: item.id,
              slug,
            })
          ),
          toastForumFailure
        )
      }
      title={t("library-remove-title")}
    />
  );
}
