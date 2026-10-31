import { useMutation } from "@confect/react";
import { CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { GraduationDecision } from "@repo/backend/confect/records/graduation";
import { Button } from "@repo/design-system/components/ui/button";
import { DatePicker } from "@repo/design-system/components/ui/date";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { decideChange } from "@/components/tenant/graduation/change";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/graduation/decision";

/** Whether the typed fields make a decision the server takes. */
const isDecision = Schema.is(GraduationDecision);

/**
 * The dialog where the principal records the head's decision on graduation for the unit's period
 * (ADR 0033, S6): its number, the date of graduation, which the rules suggest, the place of issue,
 * and the head's name and NIP, which a head who is not a civil servant leaves empty. It starts from
 * the decision on record, and once letters are issued the server keeps it as it is.
 */
export function GraduationDecisionDialog({
  open,
  overview,
  setOpen,
}: {
  open: boolean;
  overview: GraduationOverview;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolGraduation");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const decide = useMutation(records.graduations.decide).withOptimisticUpdate(
    decideChange
  );
  const [isPending, startTransition] = useTransition();
  const start = overview.decision;
  const [decision, setDecision] = useState(start?.decision ?? "");
  const [date, setDate] = useState(start?.date ?? overview.suggested);
  const [place, setPlace] = useState(start?.place ?? "");
  const [head, setHead] = useState(start?.head ?? "");
  const [nip, setNip] = useState(start?.nip ?? "");
  const next = {
    date,
    decision: decision.trim(),
    head: head.trim(),
    place: place.trim(),
    ...(nip.trim() === "" ? {} : { nip: nip.trim() }),
  };

  const submit = () =>
    startTransition(() => {
      setOpen(false);
      return saveSchool(
        () => decide({ ...next, periodId: overview.cohort.periodId, slug }),
        SOURCE
      );
    });

  return (
    <ResponsiveDialog
      description={t("decide-description", { period: overview.cohort.period })}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={!isDecision(next) || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            <HugeIcons icon={CheckmarkBadge01Icon} />
            {t("save-decision")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("decide")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-decision`}>{t("decision")}</FieldLabel>
          <Input
            id={`${id}-decision`}
            onChange={(event) => setDecision(event.target.value)}
            placeholder={t("decision-placeholder")}
            value={decision}
          />
        </Field>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>{t("date")}</FieldLabel>
            <DatePicker
              id={`${id}-date`}
              onValueChange={setDate}
              placeholder={t("date-placeholder")}
              value={date}
            />
            <FieldDescription>{t("date-description")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-place`}>{t("place")}</FieldLabel>
            <Input
              id={`${id}-place`}
              onChange={(event) => setPlace(event.target.value)}
              placeholder={t("place-placeholder")}
              value={place}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-head`}>{t("head")}</FieldLabel>
            <Input
              id={`${id}-head`}
              onChange={(event) => setHead(event.target.value)}
              placeholder={t("head-placeholder")}
              value={head}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-nip`}>{t("nip")}</FieldLabel>
            <Input
              id={`${id}-nip`}
              inputMode="numeric"
              onChange={(event) => setNip(event.target.value)}
              placeholder={t("nip-placeholder")}
              value={nip}
            />
            <FieldDescription>{t("nip-description")}</FieldDescription>
          </Field>
        </div>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
