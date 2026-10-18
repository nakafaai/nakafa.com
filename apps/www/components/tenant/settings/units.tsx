"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Npsn } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { Fragment, startTransition, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import {
  archiveUnitChange,
  setNpsnChange,
  setUnitLocaleChange,
  unarchiveUnitChange,
} from "@/components/tenant/settings/mutation.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
import type { Unit } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/units";

/** Every IANA time zone that the platform knows, as the time zone choices of a unit. */
const timeZoneItems = Arr.map(Intl.supportedValuesOf("timeZone"), (zone) => ({
  label: zone,
  value: zone,
}));

/** The content languages a unit may choose, from the platform's list of languages. */
const languageItems = Arr.map(languages, (language) => ({
  label: language.label,
  value: language.value,
}));

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolUnitsSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <SchoolUnitsBody slug={slug} />
    </SettingsPage>
  );
}

/** Renders one card per unit of the school, with its time zone and content language, and its NPSN card. */
function SchoolUnitsBody({ slug }: { slug: TenantSlug }) {
  const units = useQuery(tenancy.units.list, { slug });

  if (!QueryResult.isSuccess(units)) {
    return null;
  }

  return (
    <>
      {Arr.map(units.value, (unit) => (
        <Fragment key={unit.id}>
          <SchoolUnitCard slug={slug} unit={unit} />
          <SchoolUnitNpsnCard slug={slug} unit={unit} />
        </Fragment>
      ))}
    </>
  );
}

/**
 * Renders the national school number of one unit: its eight digits and the action
 * that saves them. The draft follows the stored number, so a refused number goes
 * back, and an archived unit shows its number without a way to change it.
 */
function SchoolUnitNpsnCard({ slug, unit }: { slug: TenantSlug; unit: Unit }) {
  const t = useTranslations("SchoolSettings");
  const setNpsn = useMutation(tenancy.units.setNpsn).withOptimisticUpdate(
    setNpsnChange
  );
  const stored = unit.npsn ?? "";
  const [npsn, setValue] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    setSeen(stored);
    setValue(stored);
  }
  const isArchived = unit.status === "archived";
  const canSave = !isArchived && Schema.is(Npsn)(npsn.trim());

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("unit-npsn")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          aria-label={t("unit-npsn")}
          disabled={isArchived}
          inputMode="numeric"
          maxLength={8}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("unit-npsn-placeholder")}
          value={npsn}
        />
      </CardContent>
      <CardSectionFooter hint={t("unit-npsn-footer")}>
        <CardSectionActions>
          <Button
            disabled={!canSave}
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () => setNpsn({ npsn: npsn.trim(), slug, unitId: unit.id }),
                  SOURCE
                )
              )
            }
            size="sm"
            type="button"
          >
            {t("unit-npsn-save")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}

/** Renders one unit: its level, its time zone and content language, and its archive action. */
function SchoolUnitCard({ slug, unit }: { slug: TenantSlug; unit: Unit }) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const setLocale = useMutation(tenancy.units.setLocale).withOptimisticUpdate(
    setUnitLocaleChange
  );
  const archive = useMutation(tenancy.units.archive).withOptimisticUpdate(
    archiveUnitChange
  );
  const restore = useMutation(tenancy.units.unarchive).withOptimisticUpdate(
    unarchiveUnitChange
  );
  const [isArchiving, setIsArchiving] = useState(false);
  const isArchived = unit.status === "archived";
  const levelLabel =
    unit.level === "other" ? t("level-other") : unit.level.toUpperCase();

  /** Saves one of the two choices of the unit, and keeps the other as it is. */
  const choose = (choice: {
    contentLanguage?: typeof AppLocaleCodeSchema.Type;
    timeZone?: string;
  }) => {
    startTransition(() =>
      saveSchool(
        () =>
          setLocale({
            contentLanguage: choice.contentLanguage ?? unit.contentLanguage,
            slug,
            timeZone: choice.timeZone ?? unit.timeZone,
            unitId: unit.id,
          }),
        SOURCE
      )
    );
  };

  const archiveUnit = () => {
    setIsArchiving(false);
    startTransition(() =>
      saveSchool(() => archive({ slug, unitId: unit.id }), SOURCE)
    );
  };

  const restoreUnit = () => {
    startTransition(() =>
      saveSchool(() => restore({ slug, unitId: unit.id }), SOURCE)
    );
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{unit.name}</CardTitle>
        <CardDescription>
          {isArchived
            ? t("unit-archived-description")
            : t("unit-level-line", { level: levelLabel })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-4">
            <Field>
              <FieldLabel htmlFor={`unit-time-zone-${unit.id}`}>
                {t("unit-time-zone")}
              </FieldLabel>
              <Select
                items={timeZoneItems}
                onValueChange={(value) => {
                  if (value !== null && value !== unit.timeZone) {
                    choose({ timeZone: value });
                  }
                }}
                value={unit.timeZone}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={isArchived}
                  id={`unit-time-zone-${unit.id}`}
                >
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
              <FieldLabel htmlFor={`unit-language-${unit.id}`}>
                {t("unit-content-language")}
              </FieldLabel>
              <Select
                items={languageItems}
                onValueChange={(value) => {
                  const language =
                    Schema.decodeUnknownOption(AppLocaleCodeSchema)(value);
                  if (
                    Option.isSome(language) &&
                    language.value !== unit.contentLanguage
                  ) {
                    choose({ contentLanguage: language.value });
                  }
                }}
                value={unit.contentLanguage}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={isArchived}
                  id={`unit-language-${unit.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Arr.map(languageItems, (item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
      <CardSectionFooter
        hint={isArchived ? t("unit-restore-footer") : t("unit-archive-footer")}
      >
        <CardSectionActions>
          {isArchived ? (
            <Button onClick={restoreUnit} size="sm" type="button">
              {t("unit-restore")}
            </Button>
          ) : (
            <Button
              onClick={() => setIsArchiving(true)}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("unit-archive")}
            </Button>
          )}
        </CardSectionActions>
      </CardSectionFooter>
      <ResponsiveDialog
        description={t("unit-archive-description")}
        footer={
          <>
            <Button
              onClick={() => setIsArchiving(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button onClick={archiveUnit} type="button" variant="destructive">
              {t("unit-archive-confirm")}
            </Button>
          </>
        }
        open={isArchiving}
        setOpen={setIsArchiving}
        title={t("unit-archive-title")}
      />
    </CardSection>
  );
}
