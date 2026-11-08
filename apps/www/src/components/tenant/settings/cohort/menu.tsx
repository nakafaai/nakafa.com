import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Delete02Icon,
  PencilEdit02Icon,
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
import { Option, Schema } from "effect";
import { type ReactNode, startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { chosenGrade } from "@/components/tenant/settings/choices";
import {
  CohortGradeField,
  CohortNameField,
} from "@/components/tenant/settings/cohort/fields";
import {
  archiveCohortChange,
  editCohortChange,
  removeCohortChange,
  restoreCohortChange,
} from "@/components/tenant/settings/groups";
import type { Cohort } from "@/components/tenant/settings/state";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * The menu of an archived cohort in the archived list: Restore, which shows the cohort as active at once, and Delete for
 * a cohort nothing uses.
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

  return (
    <CohortDelete cohort={cohort} slug={slug}>
      <DropdownMenuItem
        onClick={() =>
          startTransition(() =>
            runSchoolWrite(
              schoolCall(() => restore({ cohortId: cohort.id, slug }))
            )
          )
        }
      >
        <HugeIcons icon={ArchiveRestoreIcon} />
        {t("cohort-restore")}
      </DropdownMenuItem>
    </CohortDelete>
  );
}

/**
 * A cohort's menu with Delete as its last item, under the cohort's other actions (`children`). Delete asks first, takes
 * the cohort out of the list at once, and puts it back with the reason when the server refuses: a cohort that holds
 * students, a homeroom teacher, classes, sittings or reports stays, archived.
 */
function CohortDelete({
  children,
  cohort,
  slug,
}: {
  children: ReactNode;
  cohort: Cohort;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const remove = useMutation(tenancy.cohorts.remove).withOptimisticUpdate(
    removeCohortChange
  );

  return (
    <ConfirmRowMenu
      action={common("delete")}
      confirm={t("cohort-delete-confirm")}
      description={t("cohort-delete-description")}
      icon={Delete02Icon}
      onConfirm={() =>
        startTransition(() =>
          runSchoolWrite(
            schoolCall(() => remove({ cohortId: cohort.id, slug })),
            {
              onSaved: () =>
                toast.success({ title: "school-cohort-deleted.title" }),
            }
          )
        )
      }
      title={t("cohort-delete-title", { name: cohort.name })}
    >
      {children}
    </ConfirmRowMenu>
  );
}

/**
 * A cohort's row menu: Edit opens a dialog of its name and its school year, which starts from what the cohort holds
 * and saves only a change, Archive, and Delete for a cohort nothing uses (`CohortDelete`). An archived cohort offers
 * Restore and Delete (`SchoolCohortRestore`), because the server refuses every other write to it.
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
      <CohortDelete cohort={cohort} slug={slug}>
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
        <DropdownMenuItem
          onClick={() =>
            startTransition(() =>
              runSchoolWrite(
                schoolCall(() => archive({ cohortId: cohort.id, slug })),
                {
                  onSaved: () =>
                    toast.success(
                      { title: "school-cohort-archived.title" },
                      {
                        action: {
                          label: "undo",
                          onClick: () =>
                            startTransition(() =>
                              runSchoolWrite(
                                schoolCall(() =>
                                  restore({ cohortId: cohort.id, slug })
                                )
                              )
                            ),
                        },
                      }
                    ),
                }
              )
            )
          }
        >
          <HugeIcons icon={Archive02Icon} />
          {t("cohort-archive")}
        </DropdownMenuItem>
      </CohortDelete>
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
                  runSchoolWrite(
                    schoolCall(() =>
                      edit({
                        cohortId: cohort.id,
                        grade: grade.value,
                        name: next,
                        slug,
                      })
                    )
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
