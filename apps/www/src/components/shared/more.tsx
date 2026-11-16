import { Delete02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

/** Whether the deletion dialog of a More menu is open, and how to open or close it. */
const DeletionContext = createContext<{
  onOpenChange: (open: boolean) => void;
  open: boolean;
} | null>(null);

/** Reads whether the deletion dialog of the surrounding More menu is open. */
export function useDeletion() {
  return useRequired(DeletionContext, "useDeletion");
}

/**
 * The More menu of something its owner may delete, such as a comment or a post:
 * a ghost button that opens a menu with Delete, and the thing's deletion dialog
 * as children. The dialog mounts with the first opening of the menu, so its
 * lazily loaded code is in place before Delete can be chosen, and it reads whether
 * it is open through `useDeletion`.
 */
export function MoreMenu({
  children,
  inert,
}: {
  /** The deletion dialog, which asks before the thing is deleted. */
  children: ReactNode;
  inert: boolean;
}) {
  const t = useTranslations("Common");
  const [menuOpened, setMenuOpened] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            setMenuOpened(true);
          }
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              inert={inert}
              size="icon-sm"
              tooltip={t("more")}
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-40"
          label={t("menu-actions")}
        >
          <DropdownMenuItem
            icon={Delete02Icon}
            onClick={() => setDeleting(true)}
            variant="destructive"
          >
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {menuOpened ? (
        <DeletionContext value={{ onOpenChange: setDeleting, open: deleting }}>
          {children}
        </DeletionContext>
      ) : null}
    </>
  );
}
