"use client";

import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import {
  moveStudentChange,
  placeStudentChange,
} from "@/components/tenant/settings/cohort.client";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save.client";
import type { Cohort, Member } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/placement";

/** The ID of one cohort, as the cohort page names it. */
type CohortId = Cohort["id"];

/**
 * The page's action that places a student of the school in the cohort: the Add student
 * button, and the dialog it opens for one student. The dialog closes as the placement is
 * sent, and its student clears once the server accepts it.
 */
export function SchoolPlacementAdd({
  cohortId,
  slug,
}: {
  cohortId: CohortId;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const place = useMutation(tenancy.placements.place).withOptimisticUpdate(
    placeStudentChange
  );
  const [isOpen, setIsOpen] = useState(false);
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);

  const submit = () => {
    if (personId === undefined) {
      return;
    }
    setIsOpen(false);
    startTransition(() =>
      saveSchool(
        () => place({ cohortId, personId, slug }),
        SOURCE,
        () => setPersonId(undefined)
      )
    );
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">
        {t("placement-add")}
      </Button>
      <ResponsiveDialog
        description={t("placement-add-footer")}
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
              disabled={personId === undefined}
              onClick={submit}
              type="button"
            >
              {t("placement-add")}
            </Button>
          </>
        }
        open={isOpen}
        setOpen={setIsOpen}
        title={t("placement-add")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-student`}>
              {t("placement-student")}
            </FieldLabel>
            <SchoolPersonPicker
              id={`${id}-student`}
              onChoose={setPersonId}
              personId={personId}
              slug={slug}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

/**
 * The dialog that moves one student from their cohort to another active cohort of the same
 * period. The row menu of the student opens it, and it closes as the move is sent.
 */
export function SchoolPlacementMove({
  cohortId,
  member,
  open,
  setOpen,
  slug,
  targets,
}: {
  cohortId: CohortId;
  member: Member;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
  /** The active cohorts of the period that the student may move to. */
  targets: readonly Cohort[];
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const move = useMutation(tenancy.placements.move).withOptimisticUpdate(
    moveStudentChange(cohortId)
  );
  const [target, setTarget] = useState<CohortId | null>(null);
  const items = Arr.map(targets, (cohort) => ({
    label: cohort.name,
    value: cohort.id,
  }));

  const submit = () => {
    if (target === null) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () => move({ cohortId: target, personId: member.id, slug }),
        SOURCE,
        () => setTarget(null)
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("placement-move-footer")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={target === null} onClick={submit} type="button">
            {t("placement-move-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("placement-move")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-target`}>
            {t("placement-move-to")}
          </FieldLabel>
          <Select
            items={items}
            onValueChange={(value) =>
              setTarget(
                Option.getOrElse(
                  Schema.decodeUnknownOption(Id("tenantCohorts"))(value),
                  () => null
                )
              )
            }
            value={target}
          >
            <SelectTrigger className="w-full" id={`${id}-target`}>
              <SelectValue />
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
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
