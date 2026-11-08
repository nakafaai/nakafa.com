import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  PencilEdit02Icon,
  SchoolIcon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
import { useTenant } from "@/components/tenant/context";
import {
  archiveUnitChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation";
import type { Unit } from "@/components/tenant/settings/state";
import { UnitEditDialog } from "@/components/tenant/settings/units/edit";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

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
      runSchoolWrite(schoolCall(() => archive({ slug, unitId: unit.id })))
    );
  };

  return (
    <>
      <RowItems>
        {isArchived ? (
          <DropdownMenuItem
            icon={ArchiveRestoreIcon}
            onClick={() =>
              startTransition(() =>
                runSchoolWrite(
                  schoolCall(() => restore({ slug, unitId: unit.id }))
                )
              )
            }
          >
            {t("unit-restore")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              icon={PencilEdit02Icon}
              onClick={() => dialogs.show("edit")}
            >
              {common("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={Archive02Icon}
              onClick={() => dialogs.show("archive")}
              variant="destructive"
            >
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
        action={
          <Button onClick={archiveUnit} type="button" variant="destructive">
            {t("unit-archive-confirm")}
          </Button>
        }
        description={t("unit-archive-description")}
        open={dialogs.isOpen("archive")}
        setOpen={dialogs.setOpen}
        title={t("unit-archive-title")}
      >
        <ResponsiveDialogSubject icon={SchoolIcon}>
          {unit.name}
        </ResponsiveDialogSubject>
      </ResponsiveDialog>
    </>
  );
}
