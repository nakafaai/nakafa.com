import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
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
  const dialogs = useDialogs<"archive" | "edit">();
  const isArchived = unit.status === "archived";

  const archiveUnit = () => {
    dialogs.close();
    startTransition(() =>
      saveSchool(() => archive({ slug, unitId: unit.id }), SOURCE)
    );
  };

  return (
    <>
      <RowItems>
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
            <DropdownMenuItem onClick={() => dialogs.show("edit")}>
              <HugeIcons icon={PencilEdit02Icon} />
              {common("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => dialogs.show("archive")}
              variant="destructive"
            >
              <HugeIcons icon={Archive02Icon} />
              {t("unit-archive")}
            </DropdownMenuItem>
          </>
        )}
      </RowItems>
      {dialogs.kind === "edit" ? (
        <UnitEditDialog
          key={dialogs.key}
          open={dialogs.isOpen("edit")}
          setOpen={dialogs.setOpen}
          unit={unit}
        />
      ) : null}
      <ResponsiveDialog
        description={t("unit-archive-description")}
        footer={
          <>
            <Button onClick={dialogs.close} type="button" variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={archiveUnit} type="button" variant="destructive">
              {t("unit-archive-confirm")}
            </Button>
          </>
        }
        open={dialogs.isOpen("archive")}
        setOpen={dialogs.setOpen}
        title={t("unit-archive-title")}
      />
    </>
  );
}
