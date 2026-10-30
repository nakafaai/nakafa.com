import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import {
  archiveUnitChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Unit } from "@/components/tenant/settings/state";
import { UnitEditDialog } from "@/components/tenant/settings/units/edit";

const SOURCE = "components/tenant/settings/units/menu";

/**
 * The row menu of one school of the organisation: Edit and Archive for an active school, and Restore for an archived
 * one, which refuses every change until it is restored. Archive asks first, and each change shows at once and goes
 * back when the server refuses it. Each opening of Edit starts the form from what the school holds now.
 */
export function UnitMenu({ unit }: { unit: Unit }) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const archive = useMutation(tenancy.units.archive).withOptimisticUpdate(
    archiveUnitChange
  );
  const restore = useMutation(tenancy.units.unarchive).withOptimisticUpdate(
    unarchiveUnitChange
  );
  const [isEditing, setIsEditing] = useState(false);
  const [opening, setOpening] = useState(0);
  const [isArchiving, setIsArchiving] = useState(false);
  const isArchived = unit.status === "archived";

  const archiveUnit = () => {
    setIsArchiving(false);
    startTransition(() =>
      saveSchool(() => archive({ slug, unitId: unit.id }), SOURCE)
    );
  };

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            {isArchived ? (
              <DropdownMenuItem
                onClick={() =>
                  startTransition(() =>
                    saveSchool(() => restore({ slug, unitId: unit.id }), SOURCE)
                  )
                }
              >
                <HugeIcons icon={ArchiveRestoreIcon} />
                {t("unit-restore")}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setOpening((count) => count + 1);
                    setIsEditing(true);
                  }}
                >
                  <HugeIcons icon={PencilEdit02Icon} />
                  {common("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsArchiving(true)}
                  variant="destructive"
                >
                  <HugeIcons icon={Archive02Icon} />
                  {t("unit-archive")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <UnitEditDialog
        key={opening}
        open={isEditing}
        setOpen={setIsEditing}
        unit={unit}
      />
      <ResponsiveDialog
        description={t("unit-archive-description")}
        footer={
          <>
            <Button
              onClick={() => setIsArchiving(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button onClick={archiveUnit} type="button" variant="destructive">
              {t("unit-archive-confirm")}
            </Button>
          </>
        }
        open={isArchiving}
        setOpen={setIsArchiving}
        title={t("unit-archive-title")}
      />
    </div>
  );
}
