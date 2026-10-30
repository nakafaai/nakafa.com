import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CohortGradeField,
  CohortNameField,
  chosenGrade,
} from "@/components/tenant/settings/cohort/fields";
import {
  archiveCohortChange,
  editCohortChange,
  restoreCohortChange,
} from "@/components/tenant/settings/groups";
import { saveSchool } from "@/components/tenant/settings/save";
import { type Cohort, isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/cohort/menu";

/**
 * The restore action of an archived cohort in the archived list. The cohort shows as active at once.
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
    <div className="flex justify-end">
      <Button
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ cohortId: cohort.id, slug }), SOURCE)
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        {t("cohort-restore")}
      </Button>
    </div>
  );
}

/**
 * A cohort's row menu: Edit opens a dialog of its name and its school year, which starts from what the cohort holds
 * and saves only a change, or Archive. An archived cohort has no menu, because the server refuses every write to it,
 * so its cell stays empty.
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
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(cohort.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
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
        </DropdownMenuContent>
      </DropdownMenu>
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
    </div>
  );
}
