import { useMutation } from "@confect/react";
import { TeacherIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  assignHomeroomChange,
  unassignHomeroomChange,
} from "@/components/tenant/settings/moves";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";
import type { CohortDetail } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/homeroom";

/** The sentence that says what the dialog's action does, or what stops it. */
function hintKeyOf(
  cohort: CohortDetail
): "homeroom-archived" | "homeroom-footer" | "homeroom-remove-footer" {
  if (cohort.status === "archived") {
    return "homeroom-archived";
  }
  return cohort.homeroom === null
    ? "homeroom-footer"
    : "homeroom-remove-footer";
}

/**
 * The homeroom teacher of a cohort, as a button in the cohort page's header row that opens
 * its dialog. While the cohort has none, the dialog picks a teacher and saves them; once it
 * has one, the dialog shows the teacher and removes them. An archived cohort shows its
 * teacher and offers no change. On a phone the button keeps its icon, so the page's name
 * keeps its room.
 */
export function SchoolHomeroomAction({
  cohort,
  slug,
}: {
  cohort: CohortDetail;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const assign = useMutation(tenancy.assignments.assign).withOptimisticUpdate(
    assignHomeroomChange
  );
  const unassign = useMutation(
    tenancy.assignments.unassign
  ).withOptimisticUpdate(unassignHomeroomChange);
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<PersonId | undefined>(undefined);
  const isArchived = cohort.status === "archived";

  const save = () => {
    if (teacherId === undefined) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () => assign({ cohortId: cohort.id, personId: teacherId, slug }),
        SOURCE,
        () => setTeacherId(undefined)
      )
    );
  };

  const remove = () => {
    setOpen(false);
    startTransition(() =>
      saveSchool(() => unassign({ cohortId: cohort.id, slug }), SOURCE)
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <HugeIcons icon={TeacherIcon} />
        <span className="max-sm:sr-only">{t("homeroom-title")}</span>
      </Button>
      <ResponsiveDialog
        description={t(hintKeyOf(cohort))}
        footer={
          isArchived ? (
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {common("close")}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                {common("cancel")}
              </Button>
              {cohort.homeroom === null ? (
                <Button
                  disabled={teacherId === undefined}
                  onClick={save}
                  type="button"
                >
                  {t("homeroom-save")}
                </Button>
              ) : (
                <Button onClick={remove} type="button" variant="destructive">
                  {t("homeroom-remove")}
                </Button>
              )}
            </>
          )
        }
        open={open}
        setOpen={setOpen}
        title={t("homeroom-title")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-teacher`}>
              {t("homeroom-teacher")}
            </FieldLabel>
            {cohort.homeroom === null && !isArchived ? (
              <SchoolPersonPicker
                id={`${id}-teacher`}
                onChoose={setTeacherId}
                personId={teacherId}
              />
            ) : (
              <p id={`${id}-teacher`}>
                {cohort.homeroom === null
                  ? t("homeroom-none")
                  : cohort.homeroom.name}
              </p>
            )}
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
