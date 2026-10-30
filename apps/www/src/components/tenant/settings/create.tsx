import { QueryResult, useMutation, useQuery } from "@confect/react";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { UnitLevel, UnitName } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { StartCountry } from "@repo/backend/confect/tenancy/start";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import {
  createContext,
  startTransition,
  use,
  useId,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { CountryFlagIcon } from "@/components/shared/flag";
import { useViewerQuery } from "@/components/tenant/context";
import {
  languageItems,
  timeZoneItems,
} from "@/components/tenant/settings/choices";
import { addUnitChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Unit } from "@/components/tenant/settings/state";
import { levelsOf } from "@/components/tenant/start/state";

const SOURCE = "components/tenant/settings/create";

/** One level of a school, as the unit schema names it. */
type Level = typeof UnitLevel.Type;

/**
 * The levels a new school may take in its country: the levels the questionnaire offers
 * there, and every level for a country the questionnaire does not open a school in.
 */
const levelsIn = (country: string): readonly Level[] =>
  Schema.is(StartCountry)(country) ? levelsOf(country) : UnitLevel.literals;

/** Whether the dialog is open, and how it opens and closes, which the dialog gives its form. */
const CreateDialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

/** Reads the dialog's open state. It throws outside the dialog, which always provides it. */
function useCreateDialog() {
  const dialog = use(CreateDialogContext);
  if (dialog === null) {
    throw new Error(
      "useCreateDialog must be used within SchoolUnitCreateDialog"
    );
  }
  return dialog;
}

/**
 * The dialog that adds a school to the organisation: its name, its level, its time zone, and its
 * page language. The first choices are those of the school the organisation holds first. The
 * units and the viewer are read live, and the dialog draws once both have answered.
 */
export function SchoolUnitCreateDialog({
  open,
  setOpen,
  slug,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  // The units are read once the session settles, so the dialog never asks signed out.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const units = useQuery(tenancy.units.list, isSettled ? { slug } : "skip");
  const viewer = useViewerQuery();
  if (!(QueryResult.isSuccess(units) && QueryResult.isSuccess(viewer))) {
    return null;
  }
  const first = Arr.head(units.value);
  if (Option.isNone(first)) {
    return null;
  }

  return (
    <CreateDialogContext value={{ open, setOpen }}>
      <SchoolUnitCreateForm
        country={viewer.value.tenant.country}
        slug={slug}
        unit={first.value}
      />
    </CreateDialogContext>
  );
}

/** The form of the dialog, which holds what the teacher picks until the school is added. */
function SchoolUnitCreateForm({
  country,
  slug,
  unit,
}: {
  country: string;
  slug: TenantSlug;
  unit: Unit;
}) {
  const { open, setOpen } = useCreateDialog();
  const t = useTranslations("SchoolSettings");
  const start = useTranslations("SchoolStart");
  const common = useTranslations("Common");
  const id = useId();
  const add = useMutation(tenancy.units.create).withOptimisticUpdate(
    addUnitChange
  );
  const [name, setName] = useState("");
  // Whether the dialog closes because its unit was added, which empties the name once it has closed.
  const sent = useRef(false);
  const [level, setLevel] = useState<Level>("sma");
  // The choices start as the first school's, so only a pick the teacher makes is kept.
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [languageChoice, setLanguageChoice] = useState<
    typeof AppLocaleCodeSchema.Type | null
  >(null);
  const timeZone = zoneChoice ?? unit.timeZone;
  const contentLanguage = languageChoice ?? unit.contentLanguage;
  const trimmed = name.trim();
  const valid = Schema.is(UnitName)(trimmed);
  const levelItems = Arr.map(levelsIn(country), (value) => ({
    label:
      country === "ID"
        ? start(`level.${value}.title`)
        : start(`stage.${value}`),
    value,
  }));

  /** Adds the school and closes the dialog; the school shows at once, and a refusal takes it off. */
  const submit = () => {
    if (!valid) {
      return;
    }
    sent.current = true;
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          add({
            contentLanguage,
            level,
            name: trimmed,
            slug,
            timeZone,
          }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("unit-add-description")}
      footer={
        <>
          <p className="me-auto text-muted-foreground text-sm">
            {t("unit-add-footer")}
          </p>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!valid} onClick={submit} type="button">
            {t("unit-add-submit")}
          </Button>
        </>
      }
      // An added unit's name is cleared once the dialog has closed, so the closing dialog keeps it.
      onOpenChangeComplete={(next) => {
        if (!next && sent.current) {
          setName("");
        }
        sent.current = false;
      }}
      open={open}
      setOpen={setOpen}
      title={t("unit-add-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("unit-add-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("unit-add-name-placeholder")}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-level`}>{t("unit-add-level")}</FieldLabel>
          <Select
            items={levelItems}
            onValueChange={(value) => {
              const next = Schema.decodeUnknownOption(UnitLevel)(value);
              if (Option.isSome(next)) {
                setLevel(next.value);
              }
            }}
            value={level}
          >
            <SelectTrigger className="w-full" id={`${id}-level`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(levelItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-zone`}>{t("unit-time-zone")}</FieldLabel>
          <Select
            items={timeZoneItems}
            onValueChange={(value) => {
              if (value !== null) {
                setZoneChoice(value);
              }
            }}
            value={timeZone}
          >
            <SelectTrigger className="w-full" id={`${id}-zone`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(timeZoneItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
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
                setLanguageChoice(next.value);
              }
            }}
            value={contentLanguage}
          >
            <SelectTrigger className="w-full" id={`${id}-language`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(languageItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  <CountryFlagIcon countryCode={item.countryCode} />
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
