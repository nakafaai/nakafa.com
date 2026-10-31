import { QueryResult, useMutation, useQuery } from "@confect/react";
import roster from "@repo/backend/confect/_generated/refs/roster";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { setRosterEntryChange } from "@/components/tenant/settings/entry";
import { saveSchool } from "@/components/tenant/settings/save";
import type { CohortMember } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/nisn";

/**
 * The dialog that sets a student's NISN and under-age flag by hand, which decide whether the student needs a guardian's
 * consent (ADR 0034). The roster never shows a stored NISN, so the field starts empty and says whether one is stored,
 * and leaving it empty keeps that one. The flag starts from the roster. Save waits for a new ten-digit NISN or a changed
 * flag, closes the dialog at once, and the roster shows the change at once; a refusal goes back. Each opening is a
 * dialog of its own, so its fields start fresh.
 */
export function RosterEntryDialog({
  open,
  person,
  setOpen,
}: {
  open: boolean;
  person: CohortMember;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const entry = useQuery(
    roster.entries.get,
    open ? { personId: person.id, slug } : "skip"
  );
  const save = useMutation(roster.entries.set).withOptimisticUpdate(
    setRosterEntryChange
  );
  const [nisnText, setNisnText] = useState("");
  const [underAgeChoice, setUnderAge] = useState<boolean | null>(null);
  const loaded = QueryResult.isSuccess(entry)
    ? Option.some(entry.value)
    : Option.none();
  const stored = Option.exists(loaded, (view) => view.hasNisn);
  const storedUnderAge = Option.exists(
    loaded,
    (view) => view.underAgeLimit === true
  );
  const underAge = underAgeChoice ?? storedUnderAge;
  const nisn = Schema.decodeOption(Nisn)(nisnText.trim());
  const canSave =
    Option.isSome(loaded) &&
    (nisnText.trim() === "" || Option.isSome(nisn)) &&
    (Option.isSome(nisn) || underAge !== storedUnderAge);

  const submit = () => {
    if (!canSave) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          save({
            ...(Option.isSome(nisn) ? { nisn: nisn.value } : {}),
            personId: person.id,
            slug,
            underAgeLimit: underAge,
          }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("roster-entry-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!canSave} onClick={submit} type="button">
            {t("roster-entry-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={person.name}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-nisn`}>{t("roster-nisn")}</FieldLabel>
          <Input
            disabled={Option.isNone(loaded)}
            id={`${id}-nisn`}
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => setNisnText(event.target.value)}
            placeholder={t(stored ? "roster-nisn-stored" : "roster-nisn-none")}
            value={nisnText}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-age`}>
              {t("roster-under-age")}
            </FieldLabel>
            <FieldDescription>
              {t("roster-under-age-description")}
            </FieldDescription>
          </FieldContent>
          <Switch
            checked={underAge}
            disabled={Option.isNone(loaded)}
            id={`${id}-age`}
            onCheckedChange={setUnderAge}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
