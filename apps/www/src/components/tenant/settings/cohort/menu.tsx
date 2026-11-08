import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Delete02Icon,
  PencilEdit02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, use, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { chosenGrade } from "@/components/tenant/settings/choices";
import {
  CohortGradeField,
  CohortNameField,
} from "@/components/tenant/settings/cohort/fields";
import { CohortOverviewContext } from "@/components/tenant/settings/cohort/holds";
import {
  archiveCohortChange,
  editCohortChange,
  removeCohortChange,
  restoreCohortChange,
} from "@/components/tenant/settings/groups";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Cohort } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/cohort/menu";

/**
 * The menu of an archived cohort in the archived list: Restore, which shows the cohort as active at once, and Delete for
 * a cohort nothing holds.
 */
export function SchoolCohortRestore({
  cohort,
  slug,
}: {
  cohort: Cohort;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const restore = useMutation(tenancy.cohorts.restore).withOptimisticUpdate(
    restoreCohortChange
  );
  const remove = useCohortDelete(cohort, slug);

  return (
    <ConfirmRowMenu {...remove}>
      <DropdownMenuItem
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ cohortId: cohort.id, slug }), SOURCE)
          )
        }
      >
        <HugeIcons icon={ArchiveRestoreIcon} />
        {t("cohort-restore")}
      </DropdownMenuItem>
    </ConfirmRowMenu>
  );
}

/**
 * What a cohort's Delete needs, for the menus that end in it: the copy, the cohort it removes in the confirmation's
 * body, and whether the menu offers it at all. Delete stands only for a cohort nothing holds, as the table's overview
 * reads it with the server's own rule, so a menu never offers a delete the server refuses. It takes the cohort out of
 * the list at once.
 */
function useCohortDelete(cohort: Cohort, slug: TenantSlug) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const overview = use(CohortOverviewContext);
  const remove = useMutation(tenancy.cohorts.remove).withOptimisticUpdate(
    removeCohortChange
  );

  return {
    action: common("delete"),
    confirm: t("cohort-delete-confirm"),
    description: t("cohort-delete-description"),
    icon: Delete02Icon,
    offered:
      overview !== null &&
      Arr.some(overview, (row) => row.id === cohort.id && row.hold === null),
    onConfirm: () =>
      startTransition(() =>
        saveSchool(
          () => remove({ cohortId: cohort.id, slug }),
          SOURCE,
          () => toast.success({ title: "school-cohort-deleted.title" })
        )
      ),
    subject: {
      detail: t("cohort-delete-detail", { grade: cohort.grade }),
      icon: UserGroupIcon,
      name: cohort.name,
    },
    title: t("cohort-delete-title", { name: cohort.name }),
  };
}

/**
 * A cohort's row menu: Edit opens a dialog of its name and its school year, which starts from what the cohort holds
 * and saves only a change; under the separator stand Archive and Delete for a cohort nothing holds (`useCohortDelete`).
 * An archived cohort offers Restore and Delete (`SchoolCohortRestore`), because the server refuses every other write.
 */
export function SchoolCohortMenu({
  cohort,
  slug,
}: {
  cohort: Cohort;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const archive = useMutation(tenancy.cohorts.archive).withOptimisticUpdate(
    archiveCohortChange
  );
  const restore = useMutation(tenancy.cohorts.restore).withOptimisticUpdate(
    restoreCohortChange
  );
  const edit = useMutation(tenancy.cohorts.edit).withOptimisticUpdate(
    editCohortChange
  );
  const remove = useCohortDelete(cohort, slug);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(cohort.name);
  const [gradeValue, setGradeValue] = useState<string | null>(
    String(cohort.grade)
  );
  const next = name.trim();
  const grade = chosenGrade(gradeValue);
  const canSave =
    Schema.is(CohortName)(next) &&
    Option.exists(
      grade,
      (chosen) => chosen !== cohort.grade || next !== cohort.name
    );

  return (
    <>
      <ConfirmRowMenu
        {...remove}
        archive={
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () => archive({ cohortId: cohort.id, slug }),
                  SOURCE,
                  () =>
                    toast.success(
                      { title: "school-cohort-archived.title" },
                      {
                        action: {
                          label: "undo",
                          onClick: () =>
                            startTransition(() =>
                              saveSchool(
                                () => restore({ cohortId: cohort.id, slug }),
                                SOURCE
                              )
                            ),
                        },
                      }
                    )
                )
              )
            }
          >
            <HugeIcons icon={Archive02Icon} />
            {t("cohort-archive")}
          </DropdownMenuItem>
        }
      >
        <DropdownMenuItem
          onClick={() => {
            setName(cohort.name);
            setGradeValue(String(cohort.grade));
            setIsEditing(true);
          }}
        >
          <HugeIcons icon={PencilEdit02Icon} />
          {common("edit")}
        </DropdownMenuItem>
      </ConfirmRowMenu>
      <ResponsiveDialog
        description={t("cohort-edit-description")}
        footer={
          <>
            <Button
              onClick={() => setIsEditing(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                if (Option.isNone(grade)) {
                  return;
                }
                setIsEditing(false);
                startTransition(() =>
                  saveSchool(
                    () =>
                      edit({
                        cohortId: cohort.id,
                        grade: grade.value,
                        name: next,
                        slug,
                      }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("cohort-edit-save")}
            </Button>
          </>
        }
        open={isEditing}
        setOpen={setIsEditing}
        title={cohort.name}
      >
        <FieldGroup>
          <CohortNameField id={`${id}-name`} onChange={setName} value={name} />
          <CohortGradeField
            id={`${id}-grade`}
            onChange={setGradeValue}
            value={gradeValue}
          />
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
