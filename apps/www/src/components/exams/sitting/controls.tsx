import {
  ArrowDown01Icon,
  SmartPhone01Icon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  TimeQuarterPassIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import type { DashboardAttempt } from "@/components/exams/sitting/change";

/** The dialog of a panel action that is open, or none. */
export type PanelDialog = "add-minutes" | "allow-device" | "lock" | "unlock";

/**
 * The proctor's actions on one student as one group. The lock of an attempt in progress, or the
 * unlock of a locked one, is the main action, and the menu beside it adds minutes, for either, and
 * allows a second device, which every state allows. An attempt that takes neither shows Allow a
 * second device alone.
 */
export function StudentPanelActions({
  name,
  onOpen,
  state,
}: {
  readonly name: string;
  readonly onOpen: (dialog: PanelDialog) => void;
  readonly state: DashboardAttempt["state"];
}) {
  const t = useTranslations("Exams");

  if (state !== "inProgress" && state !== "locked") {
    return (
      <Button
        className="justify-self-start"
        onClick={() => onOpen("allow-device")}
        size="sm"
        type="button"
        variant="outline"
      >
        <HugeIcons icon={SmartPhone01Icon} />
        {t("allow-device")}
      </Button>
    );
  }

  return (
    <ButtonGroup className="justify-self-start">
      {state === "inProgress" ? (
        <Button
          onClick={() => onOpen("lock")}
          size="sm"
          type="button"
          variant="destructive"
        >
          <HugeIcons icon={SquareLock02Icon} />
          {t("lock")}
        </Button>
      ) : (
        <Button
          onClick={() => onOpen("unlock")}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeIcons icon={SquareUnlock02Icon} />
          {t("unlock")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("student-more", { name })}
              size="icon-sm"
              type="button"
              variant={state === "inProgress" ? "destructive" : "outline"}
            />
          }
        >
          <HugeIcons aria-hidden="true" icon={ArrowDown01Icon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onOpen("add-minutes")}
          >
            <HugeIcons icon={TimeQuarterPassIcon} />
            {t("add-minutes")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onOpen("allow-device")}
          >
            <HugeIcons icon={SmartPhone01Icon} />
            {t("allow-device")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
