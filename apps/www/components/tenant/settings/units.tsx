"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
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
import { startTransition, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import {
  useArchiveUnitMutation,
  useSetUnitLocaleMutation,
  useUnarchiveUnitMutation,
} from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/units";

/** One unit of the school, as the viewer query shows it. */
type Unit = Ref.Returns<typeof tenancy.viewer.get>["units"][number];

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

/** Renders one card per unit of the school, with its time zone and content language. */
export function SchoolUnitsSettings({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });

  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  return (
    <>
      {Arr.map(viewer.value.units, (unit) => (
        <SchoolUnitCard key={unit.id} slug={slug} unit={unit} />
      ))}
    </>
  );
}

/** Renders one unit: its level, its time zone and content language, and its archive action. */
function SchoolUnitCard({ slug, unit }: { slug: TenantSlug; unit: Unit }) {
  const t = useTranslations("SchoolSettings");
  const setLocale = useSetUnitLocaleMutation();
  const archive = useArchiveUnitMutation();
  const restore = useUnarchiveUnitMutation();
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
          {isArchived ? t("unit-archived-description") : t("unit-description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>{t("unit-level")}</FieldLabel>
          <p className="text-sm">{levelLabel}</p>
        </Field>
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
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>
          {isArchived ? t("unit-restore-footer") : t("unit-archive-footer")}
        </CardSectionHint>
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
          <Button onClick={archiveUnit} type="button" variant="destructive">
            {t("unit-archive-confirm")}
          </Button>
        }
        open={isArchiving}
        setOpen={setIsArchiving}
        title={t("unit-archive-title")}
      />
    </CardSection>
  );
}
