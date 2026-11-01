import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Delete02Icon,
  Folder01Icon,
  Image01Icon,
  Link04Icon,
  Pdf02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, DateTime, Match } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
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
import { LibraryEditDialog } from "@/components/tenant/classes/library/edit";
import {
  isSavedFolder,
  type LibraryFolder,
} from "@/components/tenant/classes/library/folder";
import {
  FolderRowMenu,
  NewFolder,
  useFolderList,
} from "@/components/tenant/classes/library/folders";
import {
  type LibraryItem,
  removeItemUpdate,
} from "@/components/tenant/classes/library/optimistic";
import {
  useLibraryFolder,
  useLibraryUploads,
} from "@/components/tenant/classes/library/scope";
import {
  arrivedUploads,
  type LibraryUpload,
  pendingUploads,
} from "@/components/tenant/classes/library/uploads";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { PERSON_ICONS } from "@/components/tenant/settings/choices";
import { Link } from "@/lib/routing/link";
import { schoolClassFolderTarget } from "@/lib/routing/school/target";

/** How many items the library reads each time its end comes into view. */
const LIBRARY_PAGE_SIZE = 20;

/** The icon of each kind of item. */
const KIND_ICONS = {
  folder: Folder01Icon,
  image: Image01Icon,
  link: Link04Icon,
  pdf: Pdf02Icon,
};

/** A folder as a row of the library's table. */
const folderRow = (folder: LibraryFolder) => ({
  _tag: "folder" as const,
  folder,
});

/** A saved item of the library as a row of its table. */
const itemRow = (item: LibraryItem) => ({ _tag: "item" as const, item });

/** A file the teacher is adding, as a row of the library's table until its own row arrives. */
const uploadRow = (upload: LibraryUpload) => ({
  _tag: "upload" as const,
  upload,
});

/** One row of the library's table. */
type LibraryRow =
  | ReturnType<typeof folderRow>
  | ReturnType<typeof itemRow>
  | ReturnType<typeof uploadRow>;

/** The fields every row shows: a folder's, a saved item's, or those of a file being added. */
const shownOf = (row: LibraryRow) =>
  Match.valueTags(row, {
    folder: ({ folder }) => ({
      author: folder.author,
      createdAt: folder.createdAt,
      kind: "folder" as const,
      title: folder.name,
    }),
    item: ({ item }) => item,
    upload: ({ upload }) => upload,
  });

/** The ID of a row in the table. */
const rowIdOf = (row: LibraryRow) =>
  Match.valueTags(row, {
    folder: ({ folder }) => folder.id,
    item: ({ item }) => item.id,
    upload: ({ upload }) => upload.clientKey,
  });

/** The columns of the library's table. */
const libraryColumns = tableColumns<LibraryRow>();

/**
 * The files the teacher is adding that the library's rows do not hold yet. An upload whose row arrived is remembered
 * while rendering, as React keeps state from the previous render, so its row never shows twice and never comes back.
 */
function useShownUploads(items: readonly LibraryItem[]) {
  const uploads = useStore(useLibraryUploads(), (state) => state.uploads);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const arrived = arrivedUploads(uploads, items, seen);
  if (Arr.isReadonlyArrayNonEmpty(arrived)) {
    setSeen(Arr.appendAll(seen, arrived));
  }
  return pendingUploads(uploads, items, seen);
}

/**
 * The library of a class, or one folder of it: the class header with the search over the titles and
 * Add to library for its teachers, with New folder at the top of the library, and the folders and then
 * the items, the newest first, in the page's one table card. The files the teacher is adding show first
 * from the moment the dialog closes, until their own rows arrive. A library or a folder with nothing in
 * it shows the empty state without a search, a failed read its sentence and Try again, and a viewer who
 * lost the school's access is sent to the refused page.
 */
export function LibraryList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folderId = useLibraryFolder();
  const folders = useFolderList();
  const shelved = folderId === null ? folders : [];
  // A folder's items are read once the class shows it holds the folder, so a mistyped address asks for nothing.
  const held =
    folderId === null || Arr.some(folders, (folder) => folder.id === folderId);
  const pagination = usePaginatedQuery(
    classroom.library.list,
    isSettled && held ? { classId, folderId, slug } : "skip",
    { initialNumItems: LIBRARY_PAGE_SIZE }
  );
  const items = PaginatedQueryResult.isFailure(pagination)
    ? []
    : pagination.results;
  const pending = useShownUploads(items);

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
    items.length + pending.length + shelved.length === 0;

  return (
    <TableFiltersProvider>
      <ClassHeader>
        {empty ? null : <TableSearch placeholder={t("library-search")} />}
        {Arr.contains(can, "library.manage") ? <LibraryActions /> : null}
      </ClassHeader>
      <TablePageBody>
        {empty ? (
          <LibraryEmpty />
        ) : (
          <LibraryRows
            failed={failed}
            folders={shelved}
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

/** The empty state of the library, or of one folder of it. */
function LibraryEmpty() {
  const t = useTranslations("Classroom");
  const folderId = useLibraryFolder();

  return (
    <TableEmpty
      act="reading"
      description={t(
        folderId === null
          ? "library-empty-description"
          : "library-folder-empty-description"
      )}
      title={t("library-empty")}
    />
  );
}

/** What a teacher adds from the header: a folder at the top of the library, and an item anywhere. */
function LibraryActions() {
  const folderId = useLibraryFolder();

  return (
    <ButtonGroup>
      {folderId === null ? <NewFolder /> : null}
      <AddToLibrary />
    </ButtonGroup>
  );
}

/**
 * The rows of the library: each folder, which opens on its own page, then each item's title, which
 * opens it in a new tab, who added it, and when, with the files being added first, in a data table, or
 * nothing while the first page loads. A teacher changes a row from its menu. A failed read shows its
 * sentence and Try again in the table's place.
 */
function LibraryRows({
  failed,
  folders,
  items,
  loadingFirst,
  pending,
}: {
  failed: boolean;
  folders: readonly LibraryFolder[];
  items: readonly LibraryItem[];
  loadingFirst: boolean;
  pending: readonly LibraryUpload[];
}) {
  const t = useTranslations("Classroom");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();
  const { can } = useClassScope();

  if (failed) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (loadingFirst) {
    return null;
  }
  const rows: readonly LibraryRow[] = [
    ...Arr.map(folders, folderRow),
    ...Arr.map(pending, uploadRow),
    ...Arr.map(items, itemRow),
  ];
  const columns = [
    libraryColumns.text((row) => shownOf(row).title, {
      cell: (info) => <LibraryTitle row={info.row.original} />,
      header: t("library-title"),
      id: "title",
    }),
    libraryColumns.values((row) => shownOf(row).author, {
      cell: (info) => (
        <span className="text-muted-foreground" dir="auto">
          {info.getValue()}
        </span>
      ),
      header: t("library-added-by"),
      id: "author",
      options: namedOptions(
        Arr.dedupe(Arr.map(rows, (row) => shownOf(row).author)),
        PERSON_ICONS
      ),
    }),
    libraryColumns.days((row) => shownOf(row).createdAt, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      header: t("library-added"),
      id: "added",
      timeZone: formatZone,
    }),
    ...(Arr.contains(can, "library.manage")
      ? [
          libraryColumns.menu((info) => (
            <LibraryRowMenu row={info.row.original} />
          )),
        ]
      : []),
  ];

  return (
    <DataTable columns={columns} data={rows} rowId={rowIdOf} search="title" />
  );
}

/**
 * A row's kind and title: a saved folder opens on its own page, a saved item with an address opens it
 * in a new tab, and a folder or a file being added shows its title without a link until the server keeps it.
 */
function LibraryTitle({ row }: { row: LibraryRow }) {
  const t = useTranslations("Classroom");
  const shown = shownOf(row);

  return (
    <span className="flex items-center gap-2 font-medium">
      <HugeIcons
        aria-label={t(`library-kind-${shown.kind}`)}
        className="text-muted-foreground size-4 shrink-0"
        icon={KIND_ICONS[shown.kind]}
      />
      {row._tag === "folder" && isSavedFolder(row.folder) ? (
        <LibraryFolderLink folder={row.folder} />
      ) : (
        <LibraryItemLink row={row} />
      )}
    </span>
  );
}

/** A saved folder's name, which opens the folder on its own page. */
function LibraryFolderLink({ folder }: { folder: LibraryFolder }) {
  const { classSlug, slug } = useClassScope();

  return (
    <Link
      className="underline-offset-4 hover:underline"
      dir="auto"
      {...schoolClassFolderTarget(slug, classSlug, folder.id)}
    >
      {folder.name}
    </Link>
  );
}

/** A row's title, which opens its address in a new tab when the row has one. */
function LibraryItemLink({ row }: { row: LibraryRow }) {
  const shown = shownOf(row);
  const address = row._tag === "item" ? row.item.address : null;

  return address === null ? (
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
  );
}

/** The menu of a row for a teacher: a saved folder's, a saved item's, or none for what the server is still keeping. */
function LibraryRowMenu({ row }: { row: LibraryRow }) {
  if (row._tag === "item") {
    return <LibraryRemove item={row.item} />;
  }
  return row._tag === "folder" && isSavedFolder(row.folder) ? (
    <FolderRowMenu folder={row.folder} />
  ) : null;
}

/**
 * The menu of a saved item for a teacher: Edit, which opens its dialog, and Remove, which asks first
 * and takes the row away at once.
 */
function LibraryRemove({ item }: { item: LibraryItem }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const remove = useMutation(classroom.library.remove);
  const [editing, setEditing] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
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
      >
        <DropdownMenuItem
          onClick={() => {
            setEditing((count) => count + 1);
            setIsEditing(true);
          }}
        >
          <HugeIcons icon={PencilEdit02Icon} />
          {t("library-edit")}
        </DropdownMenuItem>
      </ConfirmRowMenu>
      {editing === 0 ? null : (
        <LibraryEditDialog
          item={item}
          key={editing}
          open={isEditing}
          setOpen={setIsEditing}
        />
      )}
    </>
  );
}
