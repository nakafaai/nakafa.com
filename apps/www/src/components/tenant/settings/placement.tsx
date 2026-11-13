import { useMutation } from "@confect/react";
import {
  IdCardIcon,
  Move01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { DialogRefusal } from "@/components/shared/refusal";
import { RowItems } from "@/components/shared/table/menu";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import {
  moveStudentChange,
  placeStudentChange,
} from "@/components/tenant/settings/moves";
import { RosterEntryDialog } from "@/components/tenant/settings/nisn";
import {
  type PersonId,
  SchoolStudentPicker,
} from "@/components/tenant/settings/people";
import { SelectField } from "@/components/tenant/settings/select";
import type { Cohort, CohortMember } from "@/components/tenant/settings/state";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** The ID of one cohort, as the cohort page names it. */
type CohortId = Cohort["id"];

/**
 * The page's action that places a student of the school in the cohort: the Add student
 * button, ready from the first paint, and the dialog it opens for one student. The dialog
 * waits for the cohort: Save holds until the cohort is read. An archived cohort takes no one
 * new, so its page offers no Add student (`SchoolCohortPage`). The dialog closes as the placement
 * is sent, and its student clears once the server accepts it; a refusal opens the dialog again
 * with its student and says why inside it.
 */
export function SchoolPlacementAdd({
  cohortId,
  slug,
  status,
}: {
  cohortId: CohortId;
  slug: TenantSlug;
  /** The cohort's status, unknown until the cohort is read. */
  status: Cohort["status"] | undefined;
}) {
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");
  const id = useId();
  const place = useMutation(tenancy.placements.place).withOptimisticUpdate(
    placeStudentChange
  );
  const [isOpen, setIsOpen] = useState(false);
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);
  const [refusal, setRefusal] = useState<ToastCopy | null>(null);
  // The student stays selected until the server accepts the placement, and the submit waits for it.
  const [isPending, startPlacing] = useTransition();

  const submit = () => {
    if (personId === undefined) {
      return;
    }
    setIsOpen(false);
    setRefusal(null);
    startPlacing(() =>
      runSchoolWrite(
        schoolCall(() => place({ cohortId, personId, slug })),
        {
          onSaved: () => setPersonId(undefined),
          onRefused: (copy) => {
            setRefusal(copy);
            setIsOpen(true);
          },
        }
      )
    );
  };

  return (
    <>
      <SchoolHeaderAdd
        label={t("student-add")}
        onClick={() => setIsOpen(true)}
      />
      <ResponsiveDialog
        action={
          <Button
            disabled={
              status !== "active" || personId === undefined || isPending
            }
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("student-add")}
          </Button>
        }
        description={t("placement-add-footer")}
        open={isOpen}
        setOpen={setIsOpen}
        title={t("student-add")}
      >
        <FieldGroup>
          {refusal === null ? null : <DialogRefusal copy={refusal} />}
          <Field>
            <FieldLabel htmlFor={`${id}-student`}>
              {tCommon("student")}
            </FieldLabel>
            <SchoolStudentPicker
              cohortId={status === "active" ? cohortId : undefined}
              id={`${id}-student`}
              onChoose={setPersonId}
              personId={personId}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

/**
 * The row menu of one student: Move opens the dialog that moves the student to another active
 * cohort of the same period, which closes as the move is sent, and NISN and age opens the student's
 * roster row.
 */
export function SchoolPlacementMove({
  cohortId,
  member,
  slug,
  targets,
}: {
  cohortId: CohortId;
  member: CohortMember;
  slug: TenantSlug;
  /** The active cohorts of the period that the student may move to. */
  targets: readonly Cohort[];
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const move = useMutation(tenancy.placements.move).withOptimisticUpdate(
    moveStudentChange(cohortId)
  );
  const dialogs = useDialogs<"entry" | "move">();
  const [target, setTarget] = useState<CohortId | null>(null);
  const items = Arr.map(targets, (cohort) => ({
    icon: UserGroupIcon,
    label: cohort.name,
    value: cohort.id,
  }));

  const submit = () => {
    if (target === null) {
      return;
    }
    dialogs.close();
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() => move({ cohortId: target, personId: member.id, slug })),
        { onSaved: () => setTarget(null) }
      )
    );
  };

  return (
    <>
      <RowItems>
        <DropdownMenuItem
          icon={Move01Icon}
          onClick={() => dialogs.show("move")}
        >
          {common("move")}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={IdCardIcon}
          onClick={() => dialogs.show("entry")}
        >
          {common("nisn")}
        </DropdownMenuItem>
      </RowItems>
      {dialogs.kind === "entry" ? (
        <RosterEntryDialog
          key={dialogs.key}
          open={dialogs.isOpen("entry")}
          person={member}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      <ResponsiveDialog
        action={
          <Button disabled={target === null} onClick={submit} type="button">
            {common("move")}
          </Button>
        }
        description={t("placement-move-footer")}
        open={dialogs.isOpen("move")}
        setOpen={dialogs.setOpen}
        title={common("move")}
      >
        <FieldGroup>
          <SelectField
            items={items}
            label={t("placement-move-to")}
            menu={common("menu-cohort")}
            onChoose={(value) =>
              setTarget(
                Option.getOrElse(
                  Schema.decodeUnknownOption(Id("tenantCohorts"))(value),
                  () => null
                )
              )
            }
            placeholder={t("class-cohort-placeholder")}
            value={target}
          />
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
