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
  RotateLeft01Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialogSubject } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, DateTime, Match } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TablePages } from "@/components/shared/table/pages";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import {
  folderPath,
  type LibraryFolder,
  purgeFolderUpdate,
  restoreFolderUpdate,
} from "@/components/tenant/classes/library/folder";
import {
  type LibraryItem,
  purgeItemUpdate,
  restoreItemUpdate,
} from "@/components/tenant/classes/library/optimistic";
import { useFolderList } from "@/components/tenant/classes/library/tree";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { PERSON_ICONS } from "@/components/tenant/settings/choices";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** How many trashed items the trash reads each time its end comes into view. */
const TRASH_PAGE_SIZE = 20;

/** The icon of each kind in the trash. */
const KIND_ICONS = {
  folder: Folder01Icon,
  image: Image01Icon,
  link: Link04Icon,
  pdf: Pdf02Icon,
};

/** A trashed folder as a row of the trash. */
const folderRow = (folder: LibraryFolder) => ({
  _tag: "folder" as const,
  folder,
});

/** A trashed item as a row of the trash. */
const itemRow = (item: LibraryItem) => ({ _tag: "item" as const, item });

/** One row of the trash. */
type TrashRow = ReturnType<typeof folderRow> | ReturnType<typeof itemRow>;

/** What every row of the trash shows. */
const shownOf = (row: TrashRow) =>
  Match.valueTags(row, {
    folder: ({ folder }) => ({
      author: folder.author,
      id: folder.id,
      kind: "folder" as const,
      title: folder.name,
      trashedAt: folder.trashedAt ?? 0,
    }),
    item: ({ item }) => ({
      author: item.author,
      id: item.id,
      kind: item.kind,
      title: item.title,
      trashedAt: item.trashedAt ?? 0,
    }),
  });

const trashColumns = tableColumns<TrashRow>();

/**
 * The trash of the class library: each folder that went to the trash itself, with everything inside it, and each
 * item, the last one trashed first. Restore brings one back at once; Delete forever asks first, because it frees the
 * school's storage and cannot be undone. Whatever waits thirty days is deleted forever by itself.
 */
export function LibraryTrash() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const format = useFormatter();
  const formatZone = useFormatTimeZone();
  const folders = useFolderList();
  const pagination = usePaginatedQuery(
    classroom.library.trashed,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: TRASH_PAGE_SIZE }
  );

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }

  // A folder inside a trashed folder goes back with it, so only the folder the manager trashed shows.
  const trashedFolders = Arr.filter(
    folders,
    (folder) =>
      folder.trashedAt !== null &&
      !Arr.some(
        Arr.dropRight(folderPath(folders, folder.id), 1),
        (above) => above.trashedAt !== null
      )
  );
  const rows: readonly TrashRow[] = [
    ...Arr.map(trashedFolders, folderRow),
    ...Arr.map(pagination.results, itemRow),
  ];
  const columns = [
    trashColumns.text((row) => shownOf(row).title, {
      cell: (info) => (
        <span className="flex items-center gap-2 font-medium">
          <HugeIcons
            aria-label={t(`library-kind-${shownOf(info.row.original).kind}`)}
            className="text-muted-foreground shrink-0"
            icon={KIND_ICONS[shownOf(info.row.original).kind]}
          />
          <span dir="auto">{info.getValue()}</span>
        </span>
      ),
      header: t("library-title"),
      id: "title",
    }),
    trashColumns.values((row) => shownOf(row).kind, {
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
    trashColumns.values((row) => shownOf(row).author, {
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
    trashColumns.days((row) => shownOf(row).trashedAt, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      header: t("library-trashed"),
      id: "trashed",
      timeZone: formatZone,
    }),
    trashColumns.menu((info) => <TrashRowMenu row={info.row.original} />),
  ];

  return (
    <TablePages pageSize={TRASH_PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={rows}
        empty={
          <EmptyState
            description={t("library-trash-empty-description")}
            scene={<EmptyNina act="sweeping" />}
            title={t("library-trash-empty")}
          />
        }
        rowId={(row) => shownOf(row).id}
        search="title"
      />
    </TablePages>
  );
}

/** The menu of a trashed row: Restore, and Delete forever, which asks first. */
function TrashRowMenu({ row }: { row: TrashRow }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const restoreItem = useMutation(classroom.library.restore);
  const purgeItem = useMutation(classroom.library.purge);
  const restoreFolder = useMutation(classroom.folders.restore);
  const purgeFolder = useMutation(classroom.folders.purge);

  const restore = () =>
    runSchoolWrite(
      schoolCall(() =>
        row._tag === "item"
          ? restoreItem.withOptimisticUpdate(restoreItemUpdate)({
              classId,
              itemId: row.item.id,
              slug,
            })
          : restoreFolder.withOptimisticUpdate(restoreFolderUpdate)({
              classId,
              folderId: row.folder.id,
              slug,
            })
      )
    );
  const purge = () =>
    runSchoolWrite(
      schoolCall(() =>
        row._tag === "item"
          ? purgeItem.withOptimisticUpdate(purgeItemUpdate)({
              classId,
              itemId: row.item.id,
              slug,
            })
          : purgeFolder.withOptimisticUpdate(purgeFolderUpdate)({
              classId,
              folderId: row.folder.id,
              slug,
            })
      )
    );

  return (
    <ConfirmRowMenu
      action={t("library-purge")}
      body={
        <ResponsiveDialogSubject icon={KIND_ICONS[shownOf(row).kind]}>
          {shownOf(row).title}
        </ResponsiveDialogSubject>
      }
      confirm={t("library-purge")}
      description={t("library-purge-description")}
      icon={Delete02Icon}
      onConfirm={purge}
      title={t("library-purge-title")}
    >
      <DropdownMenuItem icon={RotateLeft01Icon} onClick={restore}>
        {t("library-restore")}
      </DropdownMenuItem>
    </ConfirmRowMenu>
  );
}
