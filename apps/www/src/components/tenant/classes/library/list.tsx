import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  Delete02Icon,
  FolderLibraryIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { useEventListener, useMergedRef } from "@mantine/hooks";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Array as Arr, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { TablePageBody } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { TableViews } from "@/components/shared/table/views";
import { ClassHeader } from "@/components/tenant/classes/header";
import { AddToLibrary } from "@/components/tenant/classes/library/create";
import { titleOf } from "@/components/tenant/classes/library/draft";
import {
  childFolders,
  folderPath,
} from "@/components/tenant/classes/library/folder";
import { NewFolder } from "@/components/tenant/classes/library/folders";
import type { LibraryItem } from "@/components/tenant/classes/library/optimistic";
import { LibraryRows } from "@/components/tenant/classes/library/rows";
import {
  useLibraryFolder,
  useLibraryUploads,
} from "@/components/tenant/classes/library/scope";
import { useFileSender } from "@/components/tenant/classes/library/sender";
import { LibraryTrash } from "@/components/tenant/classes/library/trash";
import { useFolderList } from "@/components/tenant/classes/library/tree";
import {
  arrivedUploads,
  pendingUploads,
} from "@/components/tenant/classes/library/uploads";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many items the library reads each time its end comes into view. */
const LIBRARY_PAGE_SIZE = 20;

/** What the library shows: the folder of the page, what the reader starred, or the trash. */
const LibraryMode = Schema.Literals(["files", "starred", "trash"]);

/** The icon of each view of the library. */
const VIEW_ICONS = {
  files: FolderLibraryIcon,
  starred: StarIcon,
  trash: Delete02Icon,
};

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
 * The library of a class, or one folder of it, as a Drive for the classroom: the class header with the search over
 * the titles and New folder in one group and, standing alone, Add to library for whoever manages it, the header's path running through
 * every folder above the open one; then, in the body, the Files, Starred and Trash views above the page's one table
 * card, which holds the folders and then the items, the newest first. Files dropped on the page upload into the folder
 * it shows, and a row dropped on a folder moves into it. The files being added show first with their progress from the
 * moment they start, until their own rows arrive. A failed read shows its sentence and Try again, and a viewer who lost
 * the school's access is sent to the refused page.
 */
export function LibraryList() {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  const [view, setView] = useState<typeof LibraryMode.Type>("files");
  const manages = Arr.contains(can, "library.manage");
  // The trash shows only to whoever manages the library.
  const views = manages
    ? LibraryMode.literals
    : Arr.filter(LibraryMode.literals, (shown) => shown !== "trash");

  return (
    <TableFiltersProvider>
      <ClassHeader>
        {/* The search and New folder read as one pill, and Add to library stands alone, so a phone's header holds two. */}
        <ButtonGroup>
          <TableSearch placeholder={t("library-search")} />
          {manages ? <NewFolder /> : null}
        </ButtonGroup>
        {manages ? <AddToLibrary /> : null}
      </ClassHeader>
      <TablePageBody
        views={
          <TableViews
            label={t("library-views")}
            onChoose={setView}
            view={view}
            views={Arr.map(views, (shown) => ({
              icon: VIEW_ICONS[shown],
              label: t(`library-view-${shown}`),
              value: shown,
            }))}
          />
        }
      >
        {view === "files" ? <LibraryFilesOrFound /> : null}
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
  const dropRef = useMergedRef(over, leave, drop);
  return [dropping, dropRef] as const;
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

  const [dropping, dropRef] = useFileDrop(manages, (files) => {
    if (viewer._tag !== "Success") {
      return;
    }
    for (const file of files) {
      send(viewer.value.person.name, file, titleOf(file.name));
    }
  });

  return (
    <div
      className="data-[dropping=true]:outline-primary flex min-h-0 min-w-0 flex-1 flex-col rounded-xl data-[dropping=true]:outline-2 data-[dropping=true]:outline-dashed"
      data-dropping={dropping}
      ref={dropRef}
    >
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

/** The folder the page shows, or, while the search box holds text, what the whole class library holds that matches it. */
function LibraryFilesOrFound() {
  const text = useTableFilters((state) => state.search.trim());
  return text === "" ? <LibraryFiles /> : <LibraryFound text={text} />;
}

/**
 * The items of the whole class library whose title holds the search text, newest first, read by the server, which
 * opens the sealed titles, and the folders whose name holds it. The table's own search keeps every row it shows.
 */
function LibraryFound({ text }: { text: string }) {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folders = useFolderList();
  const found = useQuery(
    classroom.library.search,
    isSettled ? { classId, slug, text: text.slice(0, 80) } : "skip"
  );

  if (QueryResult.isFailure(found)) {
    throw found.error;
  }

  return (
    <LibraryRows
      folders={Arr.filter(
        folders,
        (folder) =>
          folder.trashedAt === null &&
          folder.name.toLowerCase().includes(text.toLowerCase())
      )}
      items={QueryResult.isSuccess(found) ? found.value : []}
      pending={[]}
    />
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
