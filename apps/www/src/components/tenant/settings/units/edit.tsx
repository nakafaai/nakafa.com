import { useMutation } from "@confect/react";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
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
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { CountryFlagIcon } from "@/components/shared/flag";
import { useTenant } from "@/components/tenant/context";
import {
  languageItems,
  timeZoneItems,
} from "@/components/tenant/settings/choices";
import {
  setNpsnChange,
  setUnitLocaleChange,
} from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Unit } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/units/edit";

/**
 * The dialog that edits one school of the organisation: its time zone, the language of its pages, and its NPSN. The
 * form starts from what the school holds, Save stores only what changed and closes the dialog at once, and a refused
 * change goes back. An NPSN is eight digits, so Save waits until the field holds them, or nothing once none is stored.
 */
export function UnitEditDialog({
  open,
  setOpen,
  unit,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  unit: Unit;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const setLocale = useMutation(tenancy.units.setLocale).withOptimisticUpdate(
    setUnitLocaleChange
  );
  const setNpsn = useMutation(tenancy.units.setNpsn).withOptimisticUpdate(
    setNpsnChange
  );
  const [timeZone, setTimeZone] = useState(unit.timeZone);
  const [contentLanguage, setContentLanguage] = useState(unit.contentLanguage);
  const [npsn, setNpsnText] = useState(unit.npsn ?? "");
  const typed = npsn.trim();
  const localeChanged =
    timeZone !== unit.timeZone || contentLanguage !== unit.contentLanguage;
  const npsnChanged = typed !== (unit.npsn ?? "");
  const npsnValid = typed === "" ? unit.npsn === null : Schema.is(Npsn)(typed);
  const canSave = (localeChanged || npsnChanged) && npsnValid;

  /** Stores what changed and closes the dialog; the table shows the change at once. */
  const save = () => {
    setOpen(false);
    startTransition(() => {
      if (localeChanged) {
        saveSchool(
          () => setLocale({ contentLanguage, slug, timeZone, unitId: unit.id }),
          SOURCE
        );
      }
      if (npsnChanged) {
        saveSchool(
          () => setNpsn({ npsn: typed, slug, unitId: unit.id }),
          SOURCE
        );
      }
    });
  };

  return (
    <ResponsiveDialog
      description={t("unit-edit-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!canSave} onClick={save} type="button">
            {t("unit-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={unit.name}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-zone`}>{t("unit-time-zone")}</FieldLabel>
          <Select
            items={timeZoneItems}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeZone(value);
              }
            }}
            value={timeZone}
          >
            <SelectTrigger className="w-full" id={`${id}-zone`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(timeZoneItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-language`}>
            {t("unit-page-language")}
          </FieldLabel>
          <Select
            items={languageItems}
            onValueChange={(value) => {
              const next =
                Schema.decodeUnknownOption(AppLocaleCodeSchema)(value);
              if (Option.isSome(next)) {
                setContentLanguage(next.value);
              }
            }}
            value={contentLanguage}
          >
            <SelectTrigger className="w-full" id={`${id}-language`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(languageItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <CountryFlagIcon countryCode={item.countryCode} />
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-npsn`}>{t("unit-npsn")}</FieldLabel>
          <Input
            id={`${id}-npsn`}
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => setNpsnText(event.target.value)}
            placeholder={t("unit-npsn-placeholder")}
            value={npsn}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
