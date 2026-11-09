import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Globe02Icon } from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { type UnitLevel, UnitName } from "@repo/backend/confect/tenancy/schema";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, startTransition, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  languageItems,
  timeZoneItems,
} from "@/components/tenant/settings/choices";
import { addUnitChange } from "@/components/tenant/settings/mutation";
import { SelectField } from "@/components/tenant/settings/select";
import type { Unit } from "@/components/tenant/settings/state";
import {
  UnitLevelField,
  UnitNameField,
} from "@/components/tenant/settings/units/fields";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** Whether the dialog is open, and how it opens and closes, which the dialog gives its form. */
const CreateDialogContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

/** Reads the dialog's open state. It throws outside the dialog, which always provides it. */
function useCreateDialog() {
  return useRequired(CreateDialogContext, "useCreateDialog");
}

/**
 * The dialog that adds a school to the organisation: its name, its level, its time zone, and its
 * page language. The first choices are those of the school the organisation holds first, which the
 * live read of the units brings, so the press opens the dialog at once on any network and only Add
 * school waits for that read.
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
  const first = QueryResult.isSuccess(units)
    ? Arr.head(units.value)
    : Option.none();

  return (
    <CreateDialogContext value={{ open, setOpen }}>
      <SchoolUnitCreateForm slug={slug} unit={first} />
    </CreateDialogContext>
  );
}

/** The form of the dialog, which holds what the teacher picks until the school is added. */
function SchoolUnitCreateForm({
  slug,
  unit,
}: {
  slug: TenantSlug;
  unit: Option.Option<Unit>;
}) {
  const { open, setOpen } = useCreateDialog();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const add = useMutation(tenancy.units.create).withOptimisticUpdate(
    addUnitChange
  );
  const [name, setName] = useState("");
  // Whether the dialog closes because its unit was added, which empties the name once it has closed.
  const sent = useRef(false);
  const [level, setLevel] = useState<typeof UnitLevel.Type>("sma");
  // The choices start as the first school's, so only a pick the teacher makes is kept.
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);
  const [languageChoice, setLanguageChoice] = useState<
    typeof ActiveAppLocaleCodeSchema.Type | null
  >(null);
  const timeZone =
    zoneChoice ?? Option.getOrNull(Option.map(unit, (it) => it.timeZone));
  const contentLanguage =
    languageChoice ??
    Option.getOrNull(Option.map(unit, (it) => it.contentLanguage));
  const trimmed = name.trim();
  const ready =
    Schema.is(UnitName)(trimmed) &&
    timeZone !== null &&
    contentLanguage !== null;

  /** Adds the school and closes the dialog; the school shows at once, and a refusal takes it off. */
  const submit = () => {
    if (!(ready && timeZone !== null && contentLanguage !== null)) {
      return;
    }
    sent.current = true;
    setOpen(false);
    startTransition(() =>
      runSchoolWrite(
        schoolCall(() =>
          add({
            contentLanguage,
            level,
            name: trimmed,
            slug,
            timeZone,
          })
        )
      )
    );
  };

  return (
    <ResponsiveDialog
      action={
        <>
          <p className="text-muted-foreground me-auto text-sm">
            {t("unit-add-footer")}
          </p>
          <Button disabled={!ready} onClick={submit} type="button">
            {t("unit-add-submit")}
          </Button>
        </>
      }
      description={t("unit-add-description")}
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
        <UnitNameField id={`${id}-name`} onChange={setName} value={name} />
        <UnitLevelField onChange={setLevel} value={level} />
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
            <SelectContent label={common("menu-zone")}>
              {Arr.map(timeZoneItems, (item) => (
                <SelectItem
                  icon={Globe02Icon}
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <SelectField
          items={languageItems}
          label={t("unit-page-language")}
          menu={common("menu-language")}
          onChoose={(next) => {
            const chosen = Schema.decodeUnknownOption(
              ActiveAppLocaleCodeSchema
            )(next);
            if (Option.isSome(chosen)) {
              setLanguageChoice(chosen.value);
            }
          }}
          value={contentLanguage}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}
