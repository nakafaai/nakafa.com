import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { ClassSubject } from "@repo/backend/confect/classroom/class";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Result, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { createClassChange } from "@/components/tenant/settings/class/changes";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Cohort, Period } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/class/add";

/** The ID of one cohort, as the cohorts list of a period names it. */
type CohortId = Cohort["id"];

/**
 * The classrooms page's one action: the Add classroom button and the dialog it opens, for an active cohort of the
 * period and, outside an SD unit, the subject it learns. The button is ready from the first paint, and the dialog
 * waits for the period: its cohort choice holds until the period's cohorts are read, and a unit with no active period
 * says to open one first. The dialog closes as the add is sent, and its values clear once the server accepts the
 * classroom.
 */
export function SchoolClassAdd({
  active,
  sd,
  slug,
}: {
  /** The read of the active period whose cohort the classroom joins: its ID, or null for a unit with none. */
  active: QueryResult.QueryResult<Period["id"] | null, unknown>;
  /** Whether the unit is an SD, whose cohort learns in one classroom named for the cohort and without a subject. */
  sd: boolean;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const create = useMutation(classroom.classes.create).withOptimisticUpdate(
    createClassChange
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startSaving] = useTransition();
  const [cohortId, setCohortId] = useState<CohortId | null>(null);
  const [subject, setSubject] = useState("");
  const next = subject.trim();
  const isComplete = cohortId !== null && (sd || Schema.is(ClassSubject)(next));
  const periodId = QueryResult.isSuccess(active) ? active.value : null;
  const hasNoPeriod = QueryResult.isSuccess(active) && active.value === null;
  const startsAs = sd ? t("class-add-homeroom") : t("class-add-footer");

  const submit = () => {
    if (cohortId === null || !(sd || Schema.is(ClassSubject)(next))) {
      return;
    }
    setIsOpen(false);
    startSaving(() =>
      saveSchool(
        () => create({ cohortId, slug, ...(sd ? {} : { subject: next }) }),
        SOURCE,
        () => {
          setCohortId(null);
          setSubject("");
        }
      )
    );
  };

  return (
    <>
      <SchoolHeaderAdd
        label={t("class-create")}
        onClick={() => setIsOpen(true)}
      />
      <ResponsiveDialog
        description={hasNoPeriod ? t("class-add-no-period") : startsAs}
        footer={
          <>
            <Button
              onClick={() => setIsOpen(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!isComplete || isPending}
              inert={isPending}
              onClick={submit}
              type="button"
            >
              {t("class-create")}
            </Button>
          </>
        }
        open={isOpen}
        setOpen={setIsOpen}
        title={t("class-create")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-cohort`}>
              {t("class-cohort")}
            </FieldLabel>
            <ClassCohortSelect
              cohortId={cohortId}
              id={`${id}-cohort`}
              onChoose={setCohortId}
              periodId={periodId}
              slug={slug}
            />
          </Field>
          {sd ? null : (
            <Field>
              <FieldLabel htmlFor={`${id}-subject`}>
                {t("class-subject")}
              </FieldLabel>
              <Input
                id={`${id}-subject`}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={t("class-subject-placeholder")}
                value={subject}
              />
            </Field>
          )}
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

/**
 * The choice of the cohort that a new classroom joins, from the active cohorts of the period. The list is read as
 * soon as the period is known, so it is in when the dialog opens and the add can show the classroom at once. The
 * choice stays disabled while the list is read, and says to add a cohort first when the period has none.
 */
function ClassCohortSelect({
  cohortId,
  id,
  onChoose,
  periodId,
  slug,
}: {
  cohortId: CohortId | null;
  id: string;
  onChoose: (cohortId: CohortId | null) => void;
  periodId: Period["id"] | null;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohorts = useQuery(
    tenancy.cohorts.list,
    isSettled && periodId !== null ? { periodId, slug } : "skip"
  );
  if (QueryResult.isFailure(cohorts)) {
    throw cohorts.error;
  }
  const items = QueryResult.isSuccess(cohorts)
    ? Arr.filterMap(cohorts.value, (cohort) =>
        cohort.status === "active"
          ? Result.succeed({ label: cohort.name, value: cohort.id })
          : Result.failVoid
      )
    : [];
  const isEmpty = QueryResult.isSuccess(cohorts) && Arr.isArrayEmpty(items);

  return (
    <Select
      disabled={Arr.isArrayEmpty(items)}
      items={items}
      onValueChange={(value) =>
        onChoose(
          Option.getOrElse(
            Schema.decodeUnknownOption(Id("tenantCohorts"))(value),
            () => null
          )
        )
      }
      value={cohortId}
    >
      <SelectTrigger className="w-full" id={id}>
        <SelectValue
          placeholder={
            isEmpty ? t("class-cohort-none") : t("class-cohort-placeholder")
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
