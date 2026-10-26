import { PaginatedQueryResult, useMutation } from "@confect/react";
import { Image01Icon, Link04Icon, Pdf02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, DateTime, Option } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
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
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** How many items the library reads each time its end comes into view. */
const LIBRARY_PAGE_SIZE = 20;

/** The icon of each kind of item. */
const KIND_ICONS = {
  image: Image01Icon,
  link: Link04Icon,
  pdf: Pdf02Icon,
};

/**
 * The library of a class, the newest item first, in a table that fills the page: each item's
 * title, which opens it in a new tab, who added it, and when. The files the teacher is adding show
 * first from the moment the dialog closes, until their own rows arrive. A teacher removes an item
 * from its row's menu. A class with no item shows its empty state, a failed read its sentence and
 * Try again, and a viewer who lost the school's access is sent to the refused page.
 */
export function LibraryList({ teacher }: { teacher: boolean }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const uploads = useStore(useLibraryUploads(), (state) => state.uploads);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const pagination = usePaginatedPreloaded(
    classroom.library.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: LIBRARY_PAGE_SIZE },
    Option.none()
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
  if (PaginatedQueryResult.isFailure(pagination)) {
    return (
      <div className="p-4">
        <DataFailure onRetry={reloadPage} />
      </div>
    );
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(items) && Arr.isReadonlyArrayEmpty(pending)) {
    return (
      <TableEmpty
        act="reading"
        description={t("library-empty-description")}
        title={t("library-empty")}
      />
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("library-title")}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("library-added-by")}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {t("library-added")}
            </TableHead>
            {teacher ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(pending, (upload) => (
            <UploadRow
              key={upload.clientKey}
              teacher={teacher}
              upload={upload}
            />
          ))}
          {Arr.map(items, (item) => (
            <ItemRow item={item} key={item.id} teacher={teacher} />
          ))}
        </TableBody>
      </Table>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection
          onIntersect={() => pagination.loadMore(LIBRARY_PAGE_SIZE)}
        />
      ) : null}
    </>
  );
}

/** One item of the library: its kind and title, which opens it, who added it, when, and its menu for a teacher. */
function ItemRow({ item, teacher }: { item: LibraryItem; teacher: boolean }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const { classId, slug } = useClassScope();
  const remove = useMutation(classroom.library.remove);

  return (
    <TableRow className="h-12">
      <TableCell className="font-medium">
        <span className="flex min-w-0 items-center gap-2">
          <HugeIcons
            aria-label={t(`library-kind-${item.kind}`)}
            className="shrink-0 text-muted-foreground"
            icon={KIND_ICONS[item.kind]}
          />
          {item.address === null ? (
            <span className="truncate" dir="auto">
              {item.title}
            </span>
          ) : (
            <a
              className="truncate underline-offset-4 hover:underline"
              dir="auto"
              href={item.address}
              rel="noopener noreferrer"
              target="_blank"
            >
              {item.title}
            </a>
          )}
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {item.author}
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {format.dateTime(
          DateTime.toDateUtc(DateTime.makeUnsafe(item.createdAt)),
          { dateStyle: "medium" }
        )}
      </TableCell>
      {teacher ? (
        <TableCell>
          <ConfirmRowMenu
            action={t("library-remove")}
            confirm={t("library-remove")}
            description={t("library-remove-description")}
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
        </TableCell>
      ) : null}
    </TableRow>
  );
}

/** A file the teacher is adding, shown as its row will be, without its address until the server keeps it. */
function UploadRow({
  teacher,
  upload,
}: {
  teacher: boolean;
  upload: LibraryUpload;
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();

  return (
    <TableRow className="h-12">
      <TableCell className="font-medium">
        <span className="flex min-w-0 items-center gap-2">
          <HugeIcons
            aria-label={t(`library-kind-${upload.kind}`)}
            className="shrink-0 text-muted-foreground"
            icon={KIND_ICONS[upload.kind]}
          />
          <span className="truncate" dir="auto">
            {upload.title}
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {upload.author}
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {format.dateTime(
          DateTime.toDateUtc(DateTime.makeUnsafe(upload.createdAt)),
          { dateStyle: "medium" }
        )}
      </TableCell>
      {teacher ? <TableCell /> : null}
    </TableRow>
  );
}
