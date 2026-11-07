import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  ArrowRight01Icon,
  Folder01Icon,
  Image01Icon,
  Link04Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons";
import { useEventListener, useMergedRef } from "@mantine/hooks";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, DateTime, Match, Option, Schema } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { RowCopy, RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
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
import { titleOf } from "@/components/tenant/classes/library/draft";
import {
  childFolders,
  folderPath,
  isSavedFolder,
  isWithin,
  type LibraryFolder,
  moveFolderUpdate,
  starFolderUpdate,
} from "@/components/tenant/classes/library/folder";
import {
  FolderRowMenu,
  NewFolder,
} from "@/components/tenant/classes/library/folders";
import {
  ManagerItemMenu,
  ReaderItemMenu,
  StarItem,
  useOpenItem,
  useStar,
} from "@/components/tenant/classes/library/menu";
import {
  type LibraryItem,
  moveItemUpdate,
} from "@/components/tenant/classes/library/optimistic";
import { LibraryPath } from "@/components/tenant/classes/library/path";
import {
  useLibraryFolder,
  useLibraryUploads,
} from "@/components/tenant/classes/library/scope";
import { useFileSender } from "@/components/tenant/classes/library/sender";
import { LibraryTrash } from "@/components/tenant/classes/library/trash";
import { useFolderList } from "@/components/tenant/classes/library/tree";
import {
  arrivedUploads,
  type LibraryUpload,
  pendingUploads,
} from "@/components/tenant/classes/library/uploads";
import {
  type LibraryMode,
  LibraryViews,
} from "@/components/tenant/classes/library/views";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";
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

/** The kind of drag that carries a library row onto a folder. */
const ROW_DRAG = "application/x-nakafa-library";

/**
 * The library of a class, or one folder of it, as a Drive for the classroom: the class header with the search over
 * the titles, the Files, Starred and Trash views, and New folder and Add to library for whoever manages it; the path
 * from the top of the library; and the folders and then the items, the newest first, in the page's one table card.
 * Files dropped on the page upload into the folder it shows, and a row dropped on a folder moves into it. The files
 * being added show first with their progress from the moment they start, until their own rows arrive. A failed read
 * shows its sentence and Try again, and a viewer who lost the school's access is sent to the refused page.
 */
export function LibraryList() {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  const [view, setView] = useState<LibraryMode>("files");
  const manages = Arr.contains(can, "library.manage");

  return (
    <TableFiltersProvider>
      <ClassHeader>
        <TableSearch placeholder={t("library-search")} />
        <LibraryViews manages={manages} setView={setView} view={view} />
        {manages && view === "files" ? <LibraryActions /> : null}
      </ClassHeader>
      <TablePageBody>
        {view === "files" ? <LibraryFiles /> : null}
        {view === "starred" ? <LibraryStarred /> : null}
        {view === "trash" ? <LibraryTrash /> : null}
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** Whether a drag carries files from the device. */
const carriesFiles = (event: DragEvent) =>
  Arr.contains([...(event.dataTransfer?.types ?? [])], "Files");

/**
 * Takes files dropped from the device on the element the ref names, and says whether a drag of files is over it.
 * The listeners stand on the element itself, as the browser's drag events need.
 */
function useFileDrop(enabled: boolean, onFiles: (files: FileList) => void) {
  const [dropping, setDropping] = useState(false);
  const over = useEventListener("dragover", (event: DragEvent) => {
    if (enabled && carriesFiles(event)) {
      event.preventDefault();
      setDropping(true);
    }
  });
  const leave = useEventListener("dragleave", () => setDropping(false));
  const drop = useEventListener("drop", (event: DragEvent) => {
    setDropping(false);
    const files = event.dataTransfer?.files;
    if (!enabled || files === undefined || files.length === 0) {
      return;
    }
    event.preventDefault();
    onFiles(files);
  });
  return { dropping, ref: useMergedRef(over, leave, drop) };
}

/** The folder the page shows: its path, its folders and items, and the files dropped on it. */
function LibraryFiles() {
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folderId = useLibraryFolder();
  const folders = useFolderList();
  const viewer = useViewerQuery();
  const send = useFileSender();
  // A folder's items are read once the class shows it holds the folder, so a mistyped address asks for nothing.
  const held =
    folderId === null || Arr.some(folders, (folder) => folder.id === folderId);
  const pagination = usePaginatedQuery(
    classroom.library.list,
    isSettled && held ? { classId, folderId, slug } : "skip",
    { initialNumItems: LIBRARY_PAGE_SIZE }
  );
  const pending = useShownUploads(pagination.results);
  const manages = Arr.contains(can, "library.manage");

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }

  const dropZone = useFileDrop(manages, (files) => {
    if (viewer._tag !== "Success") {
      return;
    }
    for (const file of files) {
      send(viewer.value.person.name, file, titleOf(file.name));
    }
  });

  return (
    <div
      className="data-[dropping=true]:outline-primary flex min-w-0 flex-col gap-3 rounded-xl data-[dropping=true]:outline-2 data-[dropping=true]:outline-dashed"
      data-dropping={dropZone.dropping}
      ref={dropZone.ref}
    >
      <LibraryPath folders={folderPath(folders, folderId)} />
      <TablePages pageSize={LIBRARY_PAGE_SIZE} pagination={pagination}>
        <LibraryRows
          folders={childFolders(folders, folderId)}
          items={pagination.results}
          pending={pending}
        />
      </TablePages>
    </div>
  );
}

/** What the reader starred: their folders outside the trash, then their items, the newest first. */
function LibraryStarred() {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folders = useFolderList();
  const starred = useQuery(
    classroom.library.starred,
    isSettled ? { classId, slug } : "skip"
  );

  if (QueryResult.isFailure(starred)) {
    throw starred.error;
  }

  return (
    <LibraryRows
      folders={Arr.filter(
        folders,
        (folder) =>
          folder.starred &&
          !Arr.some(
            folderPath(folders, folder.id),
            (above) => above.trashedAt !== null
          )
      )}
      items={QueryResult.isSuccess(starred) ? starred.value : []}
      pending={[]}
    />
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

/** What a manager adds from the header: a folder and an item, inside the folder the page shows. */
function LibraryActions() {
  return (
    <ButtonGroup>
      <NewFolder />
      <AddToLibrary />
    </ButtonGroup>
  );
}

/**
 * The rows of the library: each folder, which opens on its own page, then each item's title, which
 * opens it in a new tab, its kind, who added it, and when, with the files being added first, in a data
 * table, or nothing while the first page loads. Every row's menu opens it, and a teacher changes it there
 * too. A failed read shows its sentence and Try again in the table's place.
 */
function LibraryRows({
  folders,
  items,
  pending,
}: {
  folders: readonly LibraryFolder[];
  items: readonly LibraryItem[];
  pending: readonly LibraryUpload[];
}) {
  const t = useTranslations("Classroom");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();

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
    libraryColumns.values((row) => shownOf(row).kind, {
      cell: (info) => (
        <span className="text-muted-foreground">
          {t(`library-kind-${info.getValue()}`)}
        </span>
      ),
      header: t("library-type"),
      id: "kind",
      options: Arr.map(["folder", "pdf", "image", "link"] as const, (kind) => ({
        icon: KIND_ICONS[kind],
        label: t(`library-kind-${kind}`),
        value: kind,
      })),
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
    libraryColumns.menu((info) => <LibraryRowMenu row={info.row.original} />),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      empty={<LibraryEmpty />}
      rowId={rowIdOf}
      search="title"
    />
  );
}

/** The move a row dropped on a folder asks for, or none when it would put a folder inside itself. */
function useDropMove() {
  const { classId, slug } = useClassScope();
  const folders = useFolderList();
  const moveItem = useMutation(classroom.library.move);
  const moveFolder = useMutation(classroom.folders.move);

  return (target: LibraryFolder, dragged: string) => {
    const [kind, id] = dragged.split(":");
    if (id === undefined || id === target.id) {
      return;
    }
    const folder = Arr.findFirst(folders, (found) => found.id === id);
    if (kind === "folder" && Option.isSome(folder)) {
      if (isWithin(folders, target.id, folder.value.id)) {
        return;
      }
      runForumCall(
        forumCall(() =>
          moveFolder.withOptimisticUpdate(moveFolderUpdate)({
            classId,
            folderId: folder.value.id,
            parentId: target.id,
            slug,
          })
        ),
        toastForumFailure
      );
      return;
    }
    const itemId = Schema.decodeUnknownOption(Id("classroomLibrary"))(id);
    if (kind === "item" && Option.isSome(itemId)) {
      runForumCall(
        forumCall(() =>
          moveItem.withOptimisticUpdate(moveItemUpdate)({
            classId,
            folderId: target.id,
            itemId: itemId.value,
            slug,
          })
        ),
        toastForumFailure
      );
    }
  };
}

/** What a row carries when it is dragged onto a folder: a saved folder or a saved item, and nothing else. */
const draggedOf = (row: LibraryRow) => {
  if (row._tag === "folder") {
    return isSavedFolder(row.folder) ? `folder:${row.folder.id}` : null;
  }
  return row._tag === "item" ? `item:${row.item.id}` : null;
};

/**
 * A row's kind and title: a saved folder opens on its own page and takes rows dropped on it, a saved item opens at
 * its address, and both drag onto a folder for whoever manages the library. A file being added shows its progress
 * until the server keeps it.
 */
function LibraryTitle({ row }: { row: LibraryRow }) {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  const drop = useDropMove();
  const shown = shownOf(row);
  const manages = Arr.contains(can, "library.manage");
  const dragged = manages ? draggedOf(row) : null;
  const target =
    manages && row._tag === "folder" && isSavedFolder(row.folder)
      ? row.folder
      : null;
  const start = useEventListener("dragstart", (event: DragEvent) => {
    if (dragged !== null && event.dataTransfer !== null) {
      event.dataTransfer.setData(ROW_DRAG, dragged);
      event.dataTransfer.effectAllowed = "move";
    }
  });
  const over = useEventListener("dragover", (event: DragEvent) => {
    if (
      target !== null &&
      Arr.contains([...(event.dataTransfer?.types ?? [])], ROW_DRAG)
    ) {
      event.preventDefault();
    }
  });
  const dropped = useEventListener("drop", (event: DragEvent) => {
    const carried = event.dataTransfer?.getData(ROW_DRAG) ?? "";
    if (target !== null && carried !== "") {
      event.preventDefault();
      event.stopPropagation();
      drop(target, carried);
    }
  });
  const ref = useMergedRef(start, over, dropped);

  return (
    <span
      className="flex items-center gap-2 font-medium"
      draggable={dragged !== null}
      ref={ref}
    >
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
      {row._tag === "upload" && !row.upload.sent ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {t("library-uploading", {
            percent: Math.round(row.upload.progress * 100),
          })}
        </span>
      ) : null}
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

/** A row's title, which opens a saved item: a link at its address, a file at an address signed for the opening. */
function LibraryItemLink({ row }: { row: LibraryRow }) {
  const shown = shownOf(row);
  const openItem = useOpenItem();

  return row._tag === "item" ? (
    <button
      className="cursor-pointer text-start underline-offset-4 hover:underline"
      dir="auto"
      onClick={() => openItem(row.item, false)}
      type="button"
    >
      {shown.title}
    </button>
  ) : (
    <span dir="auto">{shown.title}</span>
  );
}

/**
 * The menu of a row: a saved item's or a saved folder's actions, the manager's changes among them, and the title to
 * copy for what the server is still keeping.
 */
function LibraryRowMenu({ row }: { row: LibraryRow }) {
  const { can } = useClassScope();
  const manages = Arr.contains(can, "library.manage");

  if (
    row._tag === "upload" ||
    (row._tag === "folder" && !isSavedFolder(row.folder))
  ) {
    return <RowCopy value={shownOf(row).title} />;
  }
  if (row._tag === "item") {
    return manages ? (
      <ManagerItemMenu item={row.item} />
    ) : (
      <ReaderItemMenu item={row.item} />
    );
  }
  return manages ? (
    <FolderRowMenu folder={row.folder}>
      <LibraryOpen folder={row.folder} />
    </FolderRowMenu>
  ) : (
    <FolderReaderMenu folder={row.folder} />
  );
}

/** The menu item that opens a saved folder on its own page. */
function LibraryOpen({ folder }: { folder: LibraryFolder }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  return (
    <DropdownMenuItem
      render={
        <Link {...schoolClassFolderTarget(slug, classSlug, folder.id)}>
          <HugeIcons icon={ArrowRight01Icon} />
          {t("library-open")}
        </Link>
      }
    />
  );
}

/** The menu of a saved folder for a reader who may not change the library: open it, and star it. */
function FolderReaderMenu({ folder }: { folder: LibraryFolder }) {
  const star = useStar();

  return (
    <RowItems>
      <LibraryOpen folder={folder} />
      <StarItem
        onStar={() =>
          star(
            { folderId: folder.id, kind: "folder" },
            !folder.starred,
            starFolderUpdate
          )
        }
        starred={folder.starred}
      />
    </RowItems>
  );
}
