import { useMutation } from "@confect/react";
import { MoreHorizontalIcon, Move01Icon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { startTransition, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  moveStudentChange,
  placeStudentChange,
} from "@/components/tenant/settings/moves";
import {
  type PersonId,
  SchoolStudentPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Cohort, CohortMember } from "@/components/tenant/settings/state";

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
  // The student stays selected until the server accepts the placement, and the submit waits for it.
  const [isPending, startPlacing] = useTransition();

  const submit = () => {
    if (personId === undefined) {
      return;
    }
    setIsOpen(false);
    startPlacing(() =>
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
              disabled={personId === undefined || isPending}
              inert={isPending}
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
            <SchoolStudentPicker
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
 * The row menu of one student. Its one action opens the dialog that moves the student to
 * another active cohort of the same period, and the dialog closes as the move is sent.
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
  const id = useId();
  const move = useMutation(tenancy.placements.move).withOptimisticUpdate(
    moveStudentChange(cohortId)
  );
  const [isMoving, setIsMoving] = useState(false);
  const [target, setTarget] = useState<CohortId | null>(null);
  const items = Arr.map(targets, (cohort) => ({
    label: cohort.name,
    value: cohort.id,
  }));

  const submit = () => {
    if (target === null) {
      return;
    }
    setIsMoving(false);
    startTransition(() =>
      saveSchool(
        () => move({ cohortId: target, personId: member.id, slug }),
        SOURCE,
        () => setTarget(null)
      )
    );
  };

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setIsMoving(true)}>
            <HugeIcons icon={Move01Icon} />
            {t("placement-move")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("placement-move-footer")}
        footer={
          <>
            <Button
              onClick={() => setIsMoving(false)}
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
        open={isMoving}
        setOpen={setIsMoving}
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
    </div>
  );
}
