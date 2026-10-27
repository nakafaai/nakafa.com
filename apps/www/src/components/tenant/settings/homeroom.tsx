import { useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
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

/** The sentence that says what the card's action does, or what stops it. */
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
 * The homeroom teacher of a cohort, as one card of the settings column above the cohort's
 * students. While the cohort has none, the card picks a teacher and saves them; once it has
 * one, the card shows the teacher and removes them. An archived cohort shows its teacher and
 * offers no change.
 */
export function SchoolHomeroomCard({
  cohort,
  slug,
}: {
  cohort: CohortDetail;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const id = useId();
  const assign = useMutation(tenancy.assignments.assign).withOptimisticUpdate(
    assignHomeroomChange
  );
  const unassign = useMutation(
    tenancy.assignments.unassign
  ).withOptimisticUpdate(unassignHomeroomChange);
  const [teacherId, setTeacherId] = useState<PersonId | undefined>(undefined);
  const isArchived = cohort.status === "archived";

  const save = () => {
    if (teacherId === undefined) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () => assign({ cohortId: cohort.id, personId: teacherId, slug }),
        SOURCE,
        () => setTeacherId(undefined)
      )
    );
  };

  const remove = () =>
    startTransition(() =>
      saveSchool(() => unassign({ cohortId: cohort.id, slug }), SOURCE)
    );

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("homeroom-title")}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
      <CardSectionFooter hint={t(hintKeyOf(cohort))}>
        {isArchived ? null : (
          <CardSectionActions>
            {cohort.homeroom === null ? (
              <Button
                disabled={teacherId === undefined}
                onClick={save}
                size="sm"
                type="button"
              >
                {t("homeroom-save")}
              </Button>
            ) : (
              <Button
                onClick={remove}
                size="sm"
                type="button"
                variant="destructive"
              >
                {t("homeroom-remove")}
              </Button>
            )}
          </CardSectionActions>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}
