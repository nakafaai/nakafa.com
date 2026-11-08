import type { GroupAxisSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@repo/design-system/components/ui/select";
import { getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Option, Tuple } from "effect";
import { createContext, use } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import { CountryFlagIcon } from "@/components/shared/flag";
import { TryoutCatalogChoice } from "@/components/tryout/catalog/choice";
import {
  getTryoutExamIcons,
  getTryoutGroupIcons,
} from "@/components/tryout/catalog/icons";
import type {
  TryoutCountrySelectorOption,
  TryoutExamSelectorOption,
  TryoutGroupSelectorOption,
} from "@/components/tryout/catalog/options";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation";

/** The country on screen, the menu's label, and its options, which both variants of the selector read. */
const TryoutCountrySelectorContext = createContext<{
  currentValue: string;
  label: string;
  options: readonly TryoutCountrySelectorOption[];
} | null>(null);

/** Reads the country selector around a variant. */
function useTryoutCountrySelector() {
  const value = use(TryoutCountrySelectorContext);
  if (value === null) {
    throw new Error(
      "useTryoutCountrySelector must be used within TryoutCountrySelector"
    );
  }
  return value;
}

/**
 * Renders the try-out country selector used by country-level pages. A learner's
 * choice is saved through the page's live client, which mounts only once the page
 * holds one. A visitor's menu still links to each country.
 */
export function TryoutCountrySelector({
  currentValue,
  label,
  options,
}: {
  currentValue: string;
  label: string;
  options: readonly TryoutCountrySelectorOption[];
}) {
  return (
    <TryoutCountrySelectorContext value={{ currentValue, label, options }}>
      <ConvexIsland fallback={<TryoutCountrySelect disabled={false} />}>
        <SignedTryoutCountrySelector />
      </ConvexIsland>
    </TryoutCountrySelectorContext>
  );
}

/** A learner's country selector: a changed value saves the selected country as the learner's choice. */
function SignedTryoutCountrySelector() {
  const { currentValue, options } = useTryoutCountrySelector();
  const locale = useLocale();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const setPreferredTryout = useSetPreferredTryoutMutation(options);

  /** Persist a selected try-out country for an authenticated viewer. */
  async function handleValueChange(value: string | null) {
    if (!value || value === currentValue) {
      return;
    }

    const selectedOption = Arr.findFirst(
      options,
      (option) => option.value === value
    );

    if (Option.isNone(selectedOption)) {
      return;
    }

    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    await Effect.runPromise(
      saveTryoutPreference({
        countryKey: selectedOption.value.countryKey,
        errorMessage: {
          title: "tryout-preference-error.title",
        },
        locale,
        setPreferredTryout,
        source: "tryout-country-selector",
      })
    );
  }

  return (
    <TryoutCountrySelect
      disabled={isLoading}
      onValueChange={handleValueChange}
    />
  );
}

/** The country menu. Its options are links, and `onValueChange` only adds a learner's save. */
function TryoutCountrySelect({
  disabled,
  onValueChange,
}: {
  disabled: boolean;
  onValueChange?: (value: string | null) => void;
}) {
  const { currentValue, label, options } = useTryoutCountrySelector();
  const common = useTranslations("Common");
  const items = Arr.map(options, (option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = Arr.findFirst(
    options,
    (option) => option.value === currentValue
  );

  return (
    <Select items={items} onValueChange={onValueChange} value={currentValue}>
      <SelectTrigger
        aria-label={label}
        className="w-auto min-w-0 sm:max-w-[min(32rem,calc(100vw-2rem))]"
        disabled={disabled}
      >
        <span
          className="flex min-w-0 items-center gap-2"
          data-slot="select-value"
        >
          <CountryFlagIcon
            countryCode={Option.getOrUndefined(
              Option.map(currentOption, (option) => option.countryCode)
            )}
          />
          <span className="truncate max-sm:sr-only">
            {Option.getOrElse(
              Option.map(currentOption, (option) => option.title),
              () => label
            )}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-w-(--available-width) sm:w-max sm:min-w-(--anchor-width)"
        label={common("menu-country")}
      >
        {Arr.map(options, (option) => (
          <SelectItem
            icon={<CountryFlagIcon countryCode={option.countryCode} />}
            key={option.value}
            render={<TryoutPageLink publicPath={option.value} />}
            value={option.value}
          >
            <span className="min-w-0 leading-snug whitespace-normal sm:whitespace-nowrap">
              {option.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Renders the try-out exam selector of a group or a track page. Each exam links to
 * its entry, the first of its groups, because an exam has no page of its own.
 */
export function TryoutExamSelector({
  currentValue,
  options,
}: {
  currentValue: string;
  options: readonly TryoutExamSelectorOption[];
}) {
  const common = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const looks = getTileLooks(
    Arr.map(options, (option) =>
      Tuple.make(getTryoutExamIcons(option.examKey), option.examKey)
    )
  );
  const entries = Arr.zipWith(options, looks, (option, look) => ({
    icon: look.icon,
    publicPath: option.entryPath,
    title: option.title,
    value: option.value,
  }));

  return (
    <TryoutCatalogChoice
      current={Arr.findFirst(entries, ({ value }) => value === currentValue)}
      entries={entries}
      label={tTryouts("exam-selector-label")}
      menuLabel={common("menu-exam")}
    />
  );
}

/** The menu label of each group axis: a year, a grade, or an institution. */
const GROUP_MENU_LABELS = {
  grade: "menu-grade",
  institution: "menu-institution",
  year: "menu-year",
} as const;

/**
 * Renders the group selector beside the exam selector: the years of SNBT, the
 * grades of TKA, or the Studienkollegs of a German exam. Each group links to its
 * page and takes its own icon of its exam's axis.
 */
export function TryoutGroupSelector({
  axis,
  currentValue,
  options,
}: {
  axis: typeof GroupAxisSchema.Type;
  currentValue: string;
  options: readonly TryoutGroupSelectorOption[];
}) {
  const common = useTranslations("Common");
  const label = common(GROUP_MENU_LABELS[axis]);
  const looks = getTileLooks(
    Arr.map(options, (option) =>
      Tuple.make(getTryoutGroupIcons(axis), option.groupKey)
    )
  );
  const entries = Arr.zipWith(options, looks, (option, look) => ({
    icon: look.icon,
    publicPath: option.value,
    title: option.title,
    value: option.value,
  }));

  return (
    <TryoutCatalogChoice
      current={Arr.findFirst(entries, ({ value }) => value === currentValue)}
      entries={entries}
      label={label}
      menuLabel={label}
    />
  );
}
