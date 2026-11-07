import type { Ref } from "@confect/core";
import { type OptimisticUpdate, useMutation } from "@confect/react";
import {
  ArrowRight01Icon,
  Delete02Icon,
  Download04Icon,
  FolderTransferIcon,
  PencilEdit02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Effect } from "effect";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { LibraryEditDialog } from "@/components/tenant/classes/library/edit";
import { MoveDialog } from "@/components/tenant/classes/library/move";
import {
  type LibraryItem,
  moveItemUpdate,
  starItemUpdate,
  trashItemUpdate,
} from "@/components/tenant/classes/library/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";

/**
 * Opens one item: a link at its address, a file at an address the server signs for this opening alone. A tab opens
 * at the press, before the server answers, so the browser never takes it for a popup; a download stays on the page.
 */
export function useOpenItem() {
  const { classId, slug } = useClassScope();
  const open = useMutation(classroom.library.open);

  return (item: LibraryItem, download: boolean) => {
    if (item.address !== null && !download) {
      window.open(item.address, "_blank", "noopener,noreferrer");
      return;
    }
    const tab = download ? null : window.open("", "_blank");
    runForumCall(
      forumCall(() => open({ classId, download, itemId: item.id, slug })).pipe(
        Effect.tap((address) =>
          Effect.sync(() => {
            if (tab === null) {
              window.location.assign(address);
              return;
            }
            tab.opener = null;
            tab.location.href = address;
          })
        )
      ),
      () => {
        tab?.close();
        toastForumFailure();
      }
    );
  };
}

/** The star of an item or a folder, which shows at once and goes back if the server refuses it. */
export function useStar() {
  const { classId, slug } = useClassScope();
  const star = useMutation(classroom.library.star);

  return (
    target: Ref.Args<typeof classroom.library.star>["target"],
    starred: boolean,
    update: OptimisticUpdate<typeof classroom.library.star>
  ) =>
    runForumCall(
      forumCall(() =>
        star.withOptimisticUpdate(update)({ classId, slug, starred, target })
      ),
      toastForumFailure
    );
}

/** The menu item that stars something, or takes its star away. */
export function StarItem({
  onStar,
  starred,
}: {
  onStar: () => void;
  starred: boolean;
}) {
  const t = useTranslations("Classroom");

  return (
    <DropdownMenuItem onClick={onStar}>
      <HugeIcons icon={StarIcon} />
      {t(starred ? "library-unstar" : "library-star")}
    </DropdownMenuItem>
  );
}

/** The menu items that move something and send it to the trash, which every manager's row ends with. */
export function MoveAndTrash({
  onMove,
  onTrash,
}: {
  onMove: () => void;
  onTrash: () => void;
}) {
  const t = useTranslations("Classroom");

  return (
    <>
      <DropdownMenuItem onClick={onMove}>
        <HugeIcons icon={FolderTransferIcon} />
        {t("library-move")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onTrash} variant="destructive">
        <HugeIcons icon={Delete02Icon} />
        {t("library-trash")}
      </DropdownMenuItem>
    </>
  );
}

/** The items that open an item: Open for everyone, and Download for a file. */
function OpenItems({ item }: { item: LibraryItem }) {
  const t = useTranslations("Classroom");
  const openItem = useOpenItem();

  return (
    <>
      <DropdownMenuItem onClick={() => openItem(item, false)}>
        <HugeIcons icon={ArrowRight01Icon} />
        {t("library-open")}
      </DropdownMenuItem>
      {item.kind === "link" ? null : (
        <DropdownMenuItem onClick={() => openItem(item, true)}>
          <HugeIcons icon={Download04Icon} />
          {t("library-download")}
        </DropdownMenuItem>
      )}
    </>
  );
}

/** The menu of a saved item for a reader who may not change the library: open, download, and star. */
export function ReaderItemMenu({ item }: { item: LibraryItem }) {
  const star = useStar();

  return (
    <RowItems>
      <OpenItems item={item} />
      <StarItem
        onStar={() =>
          star({ itemId: item.id, kind: "item" }, !item.starred, starItemUpdate)
        }
        starred={item.starred}
      />
    </RowItems>
  );
}

/**
 * The menu of a saved item for whoever manages the library: open, download, star, edit, move, and trash. Each change
 * shows at once; the trash keeps the item until it is restored or deleted forever, so nothing asks first.
 */
export function ManagerItemMenu({ item }: { item: LibraryItem }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const move = useMutation(classroom.library.move);
  const trash = useMutation(classroom.library.trash);
  const star = useStar();
  const dialogs = useDialogs<"edit" | "move">();

  return (
    <>
      <RowItems>
        <OpenItems item={item} />
        <StarItem
          onStar={() =>
            star(
              { itemId: item.id, kind: "item" },
              !item.starred,
              starItemUpdate
            )
          }
          starred={item.starred}
        />
        <DropdownMenuItem onClick={() => dialogs.show("edit")}>
          <HugeIcons icon={PencilEdit02Icon} />
          {t("library-edit")}
        </DropdownMenuItem>
        <MoveAndTrash
          onMove={() => dialogs.show("move")}
          onTrash={() =>
            runForumCall(
              forumCall(() =>
                trash.withOptimisticUpdate(trashItemUpdate)({
                  classId,
                  itemId: item.id,
                  slug,
                })
              ),
              toastForumFailure
            )
          }
        />
      </RowItems>
      {dialogs.kind === "edit" ? (
        <LibraryEditDialog
          item={item}
          key={dialogs.key}
          open={dialogs.isOpen("edit")}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      {dialogs.kind === "move" ? (
        <MoveDialog
          current={item.folderId}
          key={dialogs.key}
          moving={null}
          onMove={(folderId) => {
            dialogs.close();
            runForumCall(
              forumCall(() =>
                move.withOptimisticUpdate(moveItemUpdate)({
                  classId,
                  folderId,
                  itemId: item.id,
                  slug,
                })
              ),
              toastForumFailure
            );
          }}
          open={dialogs.isOpen("move")}
          setOpen={dialogs.setOpen}
        />
      ) : null}
    </>
  );
}
