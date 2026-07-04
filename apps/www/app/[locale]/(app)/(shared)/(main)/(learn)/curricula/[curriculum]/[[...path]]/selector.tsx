"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@repo/design-system/components/ui/select";
import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { reportClientException } from "@/lib/analytics/client";

export type CurriculumSelectorOption = Readonly<{
  countryCode?: string;
  href: string;
  programKey: string;
  title: string;
  value: string;
}>;

type SavePreferredCurriculumArgs = FunctionArgs<
  typeof api.learningPreferences.mutations.setPreferredCurriculum
>;
type SavePreferredCurriculum = (
  args: SavePreferredCurriculumArgs
) => Promise<
  FunctionReturnType<
    typeof api.learningPreferences.mutations.setPreferredCurriculum
  >
>;

/** Expected failure when a background curriculum preference save fails. */
class CurriculumPreferenceSaveError extends Schema.TaggedError<CurriculumPreferenceSaveError>()(
  "CurriculumPreferenceSaveError",
  {
    cause: Schema.Unknown,
  }
) {}

/** Renders the root curriculum selector and navigates to the selected root. */
export function CurriculumSelector({
  currentValue,
  label,
  options,
}: {
  currentValue: string;
  label: string;
  options: readonly CurriculumSelectorOption[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("LearningPrograms");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const setPreferredCurriculum = useMutation(
    api.learningPreferences.mutations.setPreferredCurriculum
  );
  const items = options.map((option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = options.find((option) => option.value === currentValue);

  async function handleValueChange(value: string | null) {
    if (!value || value === currentValue) {
      return;
    }

    const selectedOption = options.find((option) => option.value === value);

    if (!selectedOption) {
      return;
    }

    if (isLoading) {
      return;
    }

    router.push(normalizeLocalizedInternalHref(selectedOption.href));

    if (!isAuthenticated) {
      return;
    }

    await Effect.runPromise(
      saveCurriculumPreference({
        errorMessage: t("preference-save-error"),
        locale,
        programKey: selectedOption.programKey,
        setPreferredCurriculum,
      })
    );
  }

  return (
    <Select
      items={items}
      onValueChange={handleValueChange}
      value={currentValue}
    >
      <SelectTrigger
        aria-label={label}
        className="w-full min-w-0 sm:w-auto sm:max-w-[min(32rem,calc(100vw-2rem))]"
        disabled={isLoading}
      >
        <span
          className="flex min-w-0 items-center gap-2"
          data-slot="select-value"
        >
          <CountryFlagIcon countryCode={currentOption?.countryCode} />
          <span className="truncate">{currentOption?.title ?? label}</span>
        </span>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="max-w-(--available-width) sm:w-max sm:min-w-(--anchor-width)"
      >
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {options.map((option) => (
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
  errorMessage: string;
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
    Effect.catchAll((error) =>
      reportClientException(error, {
        programKey,
        source: "curriculum-selector",
      }).pipe(
        Effect.zipRight(
          Effect.sync(() => {
            toast.error(errorMessage, { position: "bottom-center" });
          })
        )
      )
    )
  );
}
