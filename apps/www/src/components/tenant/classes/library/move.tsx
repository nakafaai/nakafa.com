import { Folder01Icon, FolderLibraryIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cn } from "cn";
import { Array as Arr, Order } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  folderPath,
  isWithin,
  type LibraryFolder,
} from "@/components/tenant/classes/library/folder";
import { useFolderList } from "@/components/tenant/classes/library/tree";

/** Where something moves: a folder, or the top of the library. */
type Destination = LibraryFolder["id"] | null;

/**
 * Moves an item or a folder: the dialog lists the top of the library and every folder outside the trash, each
 * indented by its depth, and Move sends it to the one chosen. A folder never lists itself or the folders inside
 * it, and the place it already sits in cannot be chosen again.
 */
export function MoveDialog({
  current,
  moving,
  onMove,
  open,
  setOpen,
}: {
  /** The folder the moved thing sits in now. */
  current: Destination;
  /** The folder being moved, whose own tree is left out, or none for an item. */
  moving: LibraryFolder["id"] | null;
  onMove: (destination: Destination) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const folders = useFolderList();
  const [chosen, setChosen] = useState<Destination>(current);
  const shown = Arr.filter(
    folders,
    (folder) =>
      folder.trashedAt === null &&
      !Arr.some(
        folderPath(folders, folder.id),
        (above) => above.trashedAt !== null
      ) &&
      (moving === null || !isWithin(folders, folder.id, moving))
  );
  const ordered = Arr.sort(
    shown,
    Order.mapInput(Order.String, (folder: LibraryFolder) =>
      Arr.join(
        Arr.map(folderPath(folders, folder.id), (above) => above.name),
        "/"
      )
    )
  );

  return (
    <ResponsiveDialog
      action={
        <Button
          disabled={chosen === current}
          onClick={() => onMove(chosen)}
          type="button"
        >
          {t("library-move")}
        </Button>
      }
      description={t("library-move-description")}
      open={open}
      setOpen={setOpen}
      title={t("library-move-title")}
    >
      <ul aria-label={t("library-move-title")} className="flex flex-col gap-1">
        <MoveChoice
          chosen={chosen === null}
          depth={0}
          icon={FolderLibraryIcon}
          label={t("library-top")}
          onChoose={() => setChosen(null)}
        />
        {Arr.map(ordered, (folder) => (
          <MoveChoice
            chosen={chosen === folder.id}
            depth={folderPath(folders, folder.id).length}
            icon={Folder01Icon}
            key={folder.id}
            label={folder.name}
            onChoose={() => setChosen(folder.id)}
          />
        ))}
      </ul>
    </ResponsiveDialog>
  );
}

/** One place the dialog offers, indented by its depth, pressed to choose it. */
function MoveChoice({
  chosen,
  depth,
  icon,
  label,
  onChoose,
}: {
  chosen: boolean;
  depth: number;
  icon: typeof Folder01Icon;
  label: string;
  onChoose: () => void;
}) {
  return (
    <li>
      <button
        aria-pressed={chosen}
        className={cn(
          "hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-md py-2 pe-3 text-start text-sm",
          chosen && "bg-accent font-medium"
        )}
        onClick={onChoose}
        style={{ paddingInlineStart: `${0.75 + depth}rem` }}
        type="button"
      >
        <HugeIcons
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
          icon={icon}
        />
        <span className="truncate" dir="auto">
          {label}
        </span>
      </button>
    </li>
  );
}
