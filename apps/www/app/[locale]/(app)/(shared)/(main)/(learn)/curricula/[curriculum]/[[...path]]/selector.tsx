"use client";

import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type refs from "@repo/backend/confect/_generated/refs";
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
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { Effect, Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useConvexAuth } from "@/components/providers/convex";
import { CountryFlagIcon } from "@/components/shared/flag";
import { reportClientException } from "@/lib/analytics/client";
import type { readRuntimeCurriculumOptions } from "@/lib/curriculum/model";
import { useSetPreferredCurriculumMutation } from "@/lib/curriculum/mutation.client";
import { isActiveLocale } from "@/lib/i18n/active";

/** One option as the server builds it from the signed program catalog. */
type CurriculumSelectorOption = ReturnType<
  typeof readRuntimeCurriculumOptions
>[number];
type SavePreferredCurriculumArgs = Ref.Args<
  typeof refs.public.learningPreferences.mutations.setPreferredCurriculum
>;
type SavePreferredCurriculum = (
  args: SavePreferredCurriculumArgs
) => InvokeReturn<
  typeof refs.public.learningPreferences.mutations.setPreferredCurriculum
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
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const setPreferredCurriculum = useSetPreferredCurriculumMutation(
    options.flatMap((option) =>
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
  const items = options.map((option) => ({
    label: option.title,
    value: option.value,
  }));
  const currentOption = options.find((option) => option.value === currentValue);
  /** Navigate to a selected curriculum and persist it for signed-in viewers. */
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
    if (!(isAuthenticated && isActiveLocale(locale))) {
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
  locale: PublicAppLocale;
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
