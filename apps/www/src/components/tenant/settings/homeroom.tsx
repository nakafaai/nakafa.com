import { useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option } from "effect";
import { startTransition, use, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { CohortOverviewContext } from "@/components/tenant/settings/cohort/holds";
import {
  assignHomeroomChange,
  unassignHomeroomChange,
} from "@/components/tenant/settings/moves";
import {
  type PersonId,
  SchoolTeacherPicker,
} from "@/components/tenant/settings/people";
import type { CohortDetail } from "@/components/tenant/settings/state";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * The dialog of a cohort's homeroom teacher, which the cohort's row menu opens, so the cohort's page holds its students'
 * list alone. It shows the teacher, and its one action removes them, or, while the cohort has none, picks a teacher and
 * saves them; an archived cohort shows its teacher and offers no change. The change shows at once.
 */
export function HomeroomDialog({
  cohort,
  slug,
}: {
  cohort: Pick<CohortDetail, "id" | "status">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const id = useId();
  const [open, setOpen] = useState(true);
  const assign = useMutation(tenancy.assignments.assign).withOptimisticUpdate(
    assignHomeroomChange
  );
  const unassign = useMutation(
    tenancy.assignments.unassign
  ).withOptimisticUpdate(unassignHomeroomChange);
  const [teacherId, setTeacherId] = useState<PersonId | undefined>(undefined);
  const isArchived = cohort.status === "archived";
  // The cohorts table that opens this dialog holds every cohort's overview, its homeroom teacher among them.
  const homeroom = Option.getOrNull(
    Option.flatMapNullishOr(
      Arr.findFirst(
        use(CohortOverviewContext) ?? [],
        (row) => row.id === cohort.id
      ),
      (row) => row.homeroom
    )
  );

  const save = () => {
    if (teacherId === undefined) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() =>
          assign({ cohortId: cohort.id, personId: teacherId, slug })
        )
      )
    );
  };

  const remove = () => {
    setOpen(false);
    startTransition(() =>
      runSchoolWrite(schoolCall(() => unassign({ cohortId: cohort.id, slug })))
    );
  };

  return (
    <ResponsiveDialog
      action={
        isArchived ? undefined : (
          <HomeroomAction
            canSave={teacherId !== undefined}
            onRemove={remove}
            onSave={save}
            teacherSet={homeroom !== null}
          />
        )
      }
      description={t(isArchived ? "homeroom-archived" : "homeroom-description")}
      open={open}
      setOpen={setOpen}
      title={t("homeroom-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-teacher`}>
            {t("homeroom-teacher")}
          </FieldLabel>
          {homeroom === null && !isArchived ? (
            <SchoolTeacherPicker
              cohortId={cohort.id}
              id={`${id}-teacher`}
              onChoose={setTeacherId}
              personId={teacherId}
            />
          ) : (
            <p className="flex min-h-9 items-center" id={`${id}-teacher`}>
              {homeroom ?? t("homeroom-none")}
            </p>
          )}
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The homeroom dialog's one action: Remove while the cohort has a teacher, or Save, which waits until a teacher is
 * chosen.
 */
function HomeroomAction({
  canSave,
  onRemove,
  onSave,
  teacherSet,
}: {
  canSave: boolean;
  onRemove: () => void;
  onSave: () => void;
  /** Whether the cohort has a homeroom teacher now. */
  teacherSet: boolean;
}) {
  const t = useTranslations("SchoolSettings");
  if (teacherSet) {
    return (
      <Button onClick={onRemove} type="button" variant="destructive">
        {t("homeroom-remove")}
      </Button>
    );
  }
  return (
    <Button disabled={!canSave} onClick={onSave} type="button">
      {t("homeroom-save")}
    </Button>
  );
}
