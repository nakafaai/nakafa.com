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

/**
 * The homeroom teacher of a cohort, as one card of the settings column above the cohort's
 * students. While the cohort has none, the card picks a teacher and saves them; once it has
 * one, the card shows the teacher and removes them. Remove and Save stay in the footer in every
 * state with the same words, each disabled while it has nothing to do, so the action a click
 * lands on never turns into another while the change shows at once. An archived cohort shows its
 * teacher and offers no change. Before the cohort is read, the card is its frame: the title, the
 * field's label, an empty line in the field's place and both actions disabled. The teacher's line
 * and the picker take one height, so nothing below moves when the cohort answers.
 */
export function SchoolHomeroomCard({
  cohort,
  slug,
}: {
  /** The cohort, or undefined while it is read. */
  cohort: CohortDetail | undefined;
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
  const isArchived = cohort?.status === "archived";
  const homeroom = cohort?.homeroom ?? null;

  const save = () => {
    if (cohort === undefined || teacherId === undefined) {
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

  const remove = () => {
    if (cohort === undefined) {
      return;
    }
    startTransition(() =>
      saveSchool(() => unassign({ cohortId: cohort.id, slug }), SOURCE)
    );
  };

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
            {cohort !== undefined && homeroom === null && !isArchived ? (
              <SchoolPersonPicker
                id={`${id}-teacher`}
                onChoose={setTeacherId}
                personId={teacherId}
              />
            ) : (
              <p className="flex min-h-9 items-center" id={`${id}-teacher`}>
                {cohort === undefined
                  ? null
                  : (homeroom?.name ?? t("homeroom-none"))}
              </p>
            )}
          </Field>
        </FieldGroup>
      </CardContent>
      <CardSectionFooter
        hint={t(isArchived ? "homeroom-archived" : "homeroom-footer")}
      >
        {isArchived ? null : (
          <CardSectionActions>
            <Button
              disabled={homeroom === null}
              onClick={remove}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("homeroom-remove")}
            </Button>
            <Button
              disabled={
                cohort === undefined ||
                homeroom !== null ||
                teacherId === undefined
              }
              onClick={save}
              size="sm"
              type="button"
            >
              {t("homeroom-save")}
            </Button>
          </CardSectionActions>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}
