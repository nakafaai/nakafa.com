"use client";

import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@repo/design-system/components/ui/select";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import type { Locale } from "@repo/internationalization/src/locale";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createContext, use } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import { CountryFlagIcon } from "@/components/shared/flag";
import { reportClientException } from "@/lib/analytics/client";
import type { readRuntimeCurriculumOptions } from "@/lib/curriculum/model";
import { useSetPreferredCurriculumMutation } from "@/lib/curriculum/mutation";
import { isActiveLocale } from "@/lib/i18n/active";
import { publicPathTarget } from "@/lib/routing/target";

type CurriculumSelectorOption = ReturnType<
  typeof readRuntimeCurriculumOptions
>[number];
type SavePreferredCurriculumArgs = Ref.Args<
  typeof learningPreferences.mutations.setPreferredCurriculum
>;
type SavePreferredCurriculum = (
  args: SavePreferredCurriculumArgs
) => InvokeReturn<typeof learningPreferences.mutations.setPreferredCurriculum>;
/** Expected failure when a background curriculum preference save fails. */
class CurriculumPreferenceSaveError extends Schema.TaggedError<CurriculumPreferenceSaveError>()(
  "CurriculumPreferenceSaveError",
  {
    cause: Schema.Unknown,
  }
) {}

/** The props of the selector and of its two variants. */
interface CurriculumSelectorProps {
  currentValue: string;
  label: string;
  options: readonly CurriculumSelectorOption[];
}

/**
 * Renders the root curriculum selector and navigates to the selected root. It shares
 * the header's one row: on a phone the trigger shows the curriculum's flag alone, named
 * for assistive technology, and from the small breakpoint it shows the title too.
 * A learner's choice is saved through the page's client, which mounts only once the
 * page holds one. A visitor's choice navigates alone.
 */
export function CurriculumSelector(props: CurriculumSelectorProps) {
  return (
    <CurriculumSelectorContext value={props}>
      <ConvexIsland fallback={<VisitorCurriculumSelector />}>
        <SignedCurriculumSelector />
      </ConvexIsland>
    </CurriculumSelectorContext>
  );
}

/** The curriculum on screen, the menu's label, and its options, which both variants of the selector read. */
const CurriculumSelectorContext = createContext<CurriculumSelectorProps | null>(
  null
);

/** Reads the curriculum selector around a variant. */
function useCurriculumSelector() {
  const value = use(CurriculumSelectorContext);
  if (value === null) {
    throw new Error(
      "useCurriculumSelector must be used within CurriculumSelector"
    );
  }
  return value;
}

/** The selected option of a change, when the change names another curriculum. */
function pickCurriculum(
  options: readonly CurriculumSelectorOption[],
  currentValue: string,
  value: string | null
) {
  if (!value || value === currentValue) {
    return Option.none<CurriculumSelectorOption>();
  }
  return Arr.findFirst(options, (option) => option.value === value);
}

/** A visitor's selector: a change navigates to the curriculum, and nothing is saved. */
function VisitorCurriculumSelector() {
  const { currentValue, options } = useCurriculumSelector();
  const navigate = useNavigate();

  /** Navigate to a selected curriculum. */
  function handleValueChange(value: string | null) {
    const selectedOption = pickCurriculum(options, currentValue, value);
    if (Option.isNone(selectedOption)) {
      return;
    }
    Option.map(publicPathTarget(selectedOption.value.publicPath), (target) =>
      navigate(target)
    );
  }

  return (
    <CurriculumSelect disabled={false} onValueChange={handleValueChange} />
  );
}

/** A learner's selector: a change navigates, and then saves the curriculum as the learner's choice. */
function SignedCurriculumSelector() {
  const { currentValue, options } = useCurriculumSelector();
  const locale = useLocale();
  const navigate = useNavigate();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const setPreferredCurriculum = useSetPreferredCurriculumMutation(
    Arr.flatMap(options, (option) =>
      option.publicSlug
        ? [
            {
              ...(option.countryCode === undefined
                ? {}
                : { countryCode: option.countryCode }),
              key: option.programKey,
              publicSlug: option.publicSlug,
              title: option.title,
            },
          ]
        : []
    )
  );

  /** Navigate to a selected curriculum and persist it for signed-in viewers. */
  async function handleValueChange(value: string | null) {
    const selectedOption = pickCurriculum(options, currentValue, value);
    if (Option.isNone(selectedOption) || isLoading) {
      return;
    }
    Option.map(publicPathTarget(selectedOption.value.publicPath), (target) =>
      navigate(target)
    );
    if (!(isAuthenticated && isActiveLocale(locale))) {
      return;
    }
    await Effect.runPromise(
      saveCurriculumPreference({
        errorMessage: {
          description: "curriculum-preference-error.description",
          title: "curriculum-preference-error.title",
        },
        locale,
        programKey: selectedOption.value.programKey,
        setPreferredCurriculum,
      })
    );
  }

  return (
    <CurriculumSelect disabled={isLoading} onValueChange={handleValueChange} />
  );
}

/** The curriculum menu that both variants share. */
function CurriculumSelect({
  disabled,
  onValueChange,
}: {
  disabled: boolean;
  onValueChange: (value: string | null) => void;
}) {
  const { currentValue, label, options } = useCurriculumSelector();
  const items = Arr.map(options, (option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = Option.getOrUndefined(
    Arr.findFirst(options, (option) => option.value === currentValue)
  );

  return (
    <Select items={items} onValueChange={onValueChange} value={currentValue}>
      <SelectTrigger
        aria-label={label}
        className="w-auto min-w-0 shrink-0 sm:max-w-[min(32rem,calc(100vw-2rem))]"
        disabled={disabled}
      >
        <span
          className="flex min-w-0 items-center gap-2"
          data-slot="select-value"
        >
          <CountryFlagIcon countryCode={currentOption?.countryCode} />
          <span className="truncate max-sm:sr-only">
            {currentOption?.title ?? label}
          </span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-w-(--available-width) sm:w-max sm:min-w-(--anchor-width)"
      >
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {Arr.map(options, (option) => (
            <SelectItem key={option.value} value={option.value}>
              <CountryFlagIcon countryCode={option.countryCode} />
              <span className="min-w-0 whitespace-normal leading-snug sm:whitespace-nowrap">
                {option.title}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Persists curriculum selection without blocking route navigation. */
function saveCurriculumPreference({
  errorMessage,
  locale,
  programKey,
  setPreferredCurriculum,
}: {
  errorMessage: ToastCopy;
  locale: Locale;
  programKey: string;
  setPreferredCurriculum: SavePreferredCurriculum;
}) {
  return Effect.tryPromise({
    try: () =>
      setPreferredCurriculum({
        locale,
        preferredCurriculumProgramKey: programKey,
      }),
    catch: (cause) => new CurriculumPreferenceSaveError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError((cause) => new CurriculumPreferenceSaveError({ cause }))
      )
    ),
    Effect.catchTag("CurriculumPreferenceSaveError", (error) =>
      reportClientException(error, {
        programKey,
        source: "curriculum-selector",
      }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            toast.error(errorMessage, { position: "bottom-center" });
          })
        )
      )
    )
  );
}
