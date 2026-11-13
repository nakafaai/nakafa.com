import { useMutation } from "@confect/react";
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
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, DateTime, Match, Option, Schema } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { RowCopy, RowItems } from "@/components/shared/table/menu";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import {
  isSavedFolder,
  isWithin,
  type LibraryFolder,
  moveFolderUpdate,
  starFolderUpdate,
} from "@/components/tenant/classes/library/folder";
import { FolderRowMenu } from "@/components/tenant/classes/library/folders";
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
import { useLibraryFolder } from "@/components/tenant/classes/library/scope";
import { useFolderList } from "@/components/tenant/classes/library/tree";
import type { LibraryUpload } from "@/components/tenant/classes/library/uploads";
import { useClassScope } from "@/components/tenant/classes/scope";
import { PERSON_ICONS } from "@/components/tenant/settings/choices";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { Link } from "@/lib/routing/link";
import { schoolClassFolderTarget } from "@/lib/routing/school/target";

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

/** The kind of drag that carries a library row onto a folder. */
const ROW_DRAG = "application/x-nakafa-library";

/** The empty state of the library, or of one folder of it. */
function LibraryEmpty() {
  const t = useTranslations("Classroom");
  const folderId = useLibraryFolder();

  return (
    <EmptyState
      description={t(
        folderId === null
          ? "library-empty-description"
          : "library-folder-empty-description"
      )}
      scene={<EmptyNina act="reading" />}
      title={t("library-empty")}
    />
  );
}

/**
 * The rows of the library: each folder, which opens on its own page, then each item's title, which
 * opens it in a new tab, its kind, who added it, and when, with the files being added first, in a data
 * table, or nothing while the first page loads. Every row's menu opens it, and a teacher changes it there
 * too. A failed read shows its sentence and Try again in the table's place.
 */
export function LibraryRows({
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
      runSchoolWrite(
        schoolCall(() =>
          moveFolder.withOptimisticUpdate(moveFolderUpdate)({
            classId,
            folderId: folder.value.id,
            parentId: target.id,
            slug,
          })
        )
      );
      return;
    }
    const itemId = Schema.decodeUnknownOption(Id("classroomLibrary"))(id);
    if (kind === "item" && Option.isSome(itemId)) {
      runSchoolWrite(
        schoolCall(() =>
          moveItem.withOptimisticUpdate(moveItemUpdate)({
            classId,
            folderId: target.id,
            itemId: itemId.value,
            slug,
          })
        )
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
        className="text-muted-foreground shrink-0"
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
      icon={ArrowRight01Icon}
      render={<Link {...schoolClassFolderTarget(slug, classSlug, folder.id)} />}
    >
      {t("library-open")}
    </DropdownMenuItem>
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
