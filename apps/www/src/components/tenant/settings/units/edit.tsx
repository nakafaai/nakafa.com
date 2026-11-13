import { useMutation } from "@confect/react";
import { Globe02Icon } from "@hugeicons/core-free-icons";
import type { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  Npsn,
  type UnitLevel,
  UnitName,
} from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { LanguageField } from "@/components/shared/language";
import { useTenant } from "@/components/tenant/context";
import { timeZoneItems } from "@/components/tenant/settings/choices";
import {
  editUnitChange,
  setNpsnChange,
  setUnitLocaleChange,
} from "@/components/tenant/settings/mutation";
import { SelectField } from "@/components/tenant/settings/select";
import type { Unit } from "@/components/tenant/settings/state";
import {
  UnitLevelField,
  UnitNameField,
} from "@/components/tenant/settings/units/fields";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * The edit's fields. Only what the teacher picks or types is kept; until then each field shows what the
 * school holds. It also says which of the school's three changes the fields hold, and whether Save may store them.
 */
function useUnitDraft(unit: Unit) {
  const [nameText, setName] = useState<string | null>(null);
  const [levelChoice, setLevel] = useState<typeof UnitLevel.Type | null>(null);
  const [zoneChoice, setTimeZone] = useState<string | null>(null);
  const [languageChoice, setContentLanguage] = useState<
    typeof ActiveAppLocaleCodeSchema.Type | null
  >(null);
  const [npsnText, setNpsnText] = useState<string | null>(null);
  const name = (nameText ?? unit.name).trim();
  const level = levelChoice ?? unit.level;
  const timeZone = zoneChoice ?? unit.timeZone;
  const contentLanguage = languageChoice ?? unit.contentLanguage;
  const npsn = npsnText ?? unit.npsn ?? "";
  const typed = npsn.trim();
  const identityChanged = name !== unit.name || level !== unit.level;
  const localeChanged =
    timeZone !== unit.timeZone || contentLanguage !== unit.contentLanguage;
  const npsnChanged = typed !== (unit.npsn ?? "");
  const npsnValid = typed === "" ? unit.npsn === null : Schema.is(Npsn)(typed);
  const canSave =
    (identityChanged || localeChanged || npsnChanged) &&
    Schema.is(UnitName)(name) &&
    npsnValid;

  return {
    canSave,
    contentLanguage,
    identityChanged,
    level,
    localeChanged,
    name,
    nameText,
    npsn,
    npsnChanged,
    setContentLanguage,
    setLevel,
    setName,
    setNpsnText,
    setTimeZone,
    timeZone,
    typed,
  };
}

/**
 * The dialog that edits one school of the organisation: its name, its level, its time zone, the language of its pages,
 * and its NPSN. The form starts from what the school holds, Save stores only what changed and closes the dialog at
 * once, and a refused change goes back. Save waits for a name, and an NPSN is eight digits, so Save waits until the
 * field holds them, or nothing once none is stored.
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
  const edit = useMutation(tenancy.units.edit).withOptimisticUpdate(
    editUnitChange
  );
  const setLocale = useMutation(tenancy.units.setLocale).withOptimisticUpdate(
    setUnitLocaleChange
  );
  const setNpsn = useMutation(tenancy.units.setNpsn).withOptimisticUpdate(
    setNpsnChange
  );
  const {
    canSave,
    contentLanguage,
    identityChanged,
    level,
    localeChanged,
    name,
    nameText,
    npsn,
    npsnChanged,
    setContentLanguage,
    setLevel,
    setName,
    setNpsnText,
    setTimeZone,
    timeZone,
    typed,
  } = useUnitDraft(unit);

  /** Stores what changed and closes the dialog; the table shows the change at once. */
  const save = () => {
    setOpen(false);
    startTransition(() => {
      if (identityChanged) {
        runSchoolWrite(
          schoolCall(() => edit({ level, name, slug, unitId: unit.id }))
        );
      }
      if (localeChanged) {
        runSchoolWrite(
          schoolCall(() =>
            setLocale({ contentLanguage, slug, timeZone, unitId: unit.id })
          )
        );
      }
      if (npsnChanged) {
        runSchoolWrite(
          schoolCall(() => setNpsn({ npsn: typed, slug, unitId: unit.id }))
        );
      }
    });
  };

  return (
    <ResponsiveDialog
      action={
        <Button disabled={!canSave} onClick={save} type="button">
          {t("unit-save")}
        </Button>
      }
      description={t("unit-edit-description")}
      open={open}
      setOpen={setOpen}
      title={unit.name}
    >
      <FieldGroup>
        <UnitNameField
          id={`${id}-name`}
          onChange={setName}
          value={nameText ?? unit.name}
        />
        <UnitLevelField onChange={setLevel} value={level} />
        <SelectField
          items={Arr.map(timeZoneItems, (item) => ({
            ...item,
            icon: Globe02Icon,
          }))}
          label={t("unit-time-zone")}
          menu={common("menu-zone")}
          onChoose={setTimeZone}
          value={timeZone}
        />
        <LanguageField
          label={t("unit-page-language")}
          onChoose={setContentLanguage}
          value={contentLanguage}
        />
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
