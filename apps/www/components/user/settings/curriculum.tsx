"use client";

import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import { QueryResult, useQuery } from "@confect/react";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import type { PublicAppLocale } from "@repo/internationalization/src/routing";
import { useForm } from "@tanstack/react-form";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { CountryFlagIcon } from "@/components/shared/flag";
import { reportClientException } from "@/lib/analytics/client";
import { useSetPreferredCurriculumMutation } from "@/lib/curriculum/mutation.client";
import { isActiveLocale } from "@/lib/i18n/active";

type CurriculumPrograms = Ref.Returns<
  typeof learningPreferences.queries.listCurriculumPrograms
>;
type CurriculumProgramOption = CurriculumPrograms[number];
type SavePreferredCurriculumArgs = Ref.Args<
  typeof learningPreferences.mutations.setPreferredCurriculum
>;
type SavePreferredCurriculum = (
  args: SavePreferredCurriculumArgs
) => InvokeReturn<typeof learningPreferences.mutations.setPreferredCurriculum>;
const formSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    preferredCurriculumProgramKey: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1))
    ),
  })
);
/** Expected failure when the submitted curriculum preference is invalid. */
class CurriculumPreferenceValidationError extends Schema.TaggedError<CurriculumPreferenceValidationError>()(
  "CurriculumPreferenceValidationError",
  {
    cause: Schema.Unknown,
  }
) {}
/** Expected failure when Convex cannot save the selected curriculum preference. */
class CurriculumPreferenceMutationError extends Schema.TaggedError<CurriculumPreferenceMutationError>()(
  "CurriculumPreferenceMutationError",
  {
    cause: Schema.Unknown,
  }
) {}
interface UserSettingsCurriculumProps {
  initialPreference: Ref.Returns<typeof learningPreferences.queries.getCurrent>;
  initialPrograms: Ref.Returns<
    typeof learningPreferences.queries.listCurriculumPrograms
  >;
  locale: PublicAppLocale;
}
/** Renders the settings form that saves the user's preferred curriculum. */
export function UserSettingsCurriculum({
  locale,
  initialPreference,
  initialPrograms,
}: UserSettingsCurriculumProps) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const preferenceQuery = useQuery(
    learningPreferences.queries.getCurrent,
    isAuthenticated ? { locale } : "skip"
  );
  const programsQuery = useQuery(
    learningPreferences.queries.listCurriculumPrograms,
    { locale }
  );
  if (QueryResult.isFailure(preferenceQuery)) {
    throw preferenceQuery.error;
  }
  if (QueryResult.isFailure(programsQuery)) {
    throw programsQuery.error;
  }
  const preference = QueryResult.isSuccess(preferenceQuery)
    ? preferenceQuery.value
    : initialPreference;
  const programs = QueryResult.isSuccess(programsQuery)
    ? programsQuery.value
    : initialPrograms;
  return (
    <UserSettingsCurriculumForm
      initialProgramKey={preference?.preferredCurriculumProgramKey ?? ""}
      programs={programs}
    />
  );
}
/** Owns the curriculum preference form state after Convex data is ready. */
function UserSettingsCurriculumForm({
  initialProgramKey,
  programs,
}: {
  initialProgramKey: string;
  programs: readonly CurriculumProgramOption[];
}) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const setPreferredCurriculum = useSetPreferredCurriculumMutation(programs);
  const selectItems = Arr.map(programs, (program) => ({
    label: (
      <>
        <CountryFlagIcon countryCode={program.countryCode} />
        {program.title}
      </>
    ),
    value: program.key,
  }));
  const form = useForm({
    defaultValues: {
      preferredCurriculumProgramKey: initialProgramKey,
    },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      if (!isActiveLocale(locale)) {
        return;
      }
      const handleMutationError = (error: CurriculumPreferenceMutationError) =>
        reportClientException(error, {
          source: "user-settings-curriculum",
        }).pipe(Effect.as(false));
      const handleValidationError = () => Effect.succeed(false);
      const didSave = await Effect.runPromise(
        submitCurriculumPreference({
          locale,
          programs,
          setPreferredCurriculum,
          value,
        }).pipe(
          Effect.as(true),
          Effect.catchTags({
            CurriculumPreferenceMutationError: handleMutationError,
            CurriculumPreferenceValidationError: handleValidationError,
          })
        )
      );
      if (!didSave) {
        return;
      }
      form.reset(value);
    },
  });
  return (
    <form action={() => form.handleSubmit()} id="user-settings-curriculum-form">
      <CardSection>
        <CardHeader>
          <CardTitle>{t("curriculum")}</CardTitle>
          <CardDescription>{t("curriculum-description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form.Field name="preferredCurriculumProgramKey">
            {(field) => (
              <Field>
                <FieldLabel
                  className="sr-only"
                  htmlFor="user-settings-curriculum"
                >
                  {t("curriculum")}
                </FieldLabel>
                <Select
                  items={selectItems}
                  name={field.name}
                  onValueChange={(value) => {
                    if (value) {
                      field.handleChange(value);
                    }
                  }}
                  value={field.state.value || undefined}
                >
                  <SelectTrigger
                    className="w-full max-w-xs"
                    id="user-settings-curriculum"
                  >
                    <SelectValue placeholder={t("curriculum-placeholder")} />
                  </SelectTrigger>
                  <SelectContent className="max-w-(--available-width)">
                    <SelectGroup>
                      {Arr.map(programs, (program) => (
                        <SelectItem key={program.key} value={program.key}>
                          <CountryFlagIcon countryCode={program.countryCode} />
                          <span className="min-w-0 whitespace-normal leading-snug">
                            {program.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
        </CardContent>
        <CardSectionFooter>
          <form.Subscribe
            selector={(state) => [
              state.isDirty,
              state.isValid,
              state.isSubmitting,
            ]}
          >
            {([isDirty, isValid, isSubmitting]) => (
              <div className="flex w-full items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm">
                  {t("curriculum-footer")}
                </p>
                <Button
                  disabled={!(isDirty && isValid) || isSubmitting}
                  size="sm"
                  type="submit"
                >
                  {t("save")}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </CardSectionFooter>
      </CardSection>
    </form>
  );
}
/** Saves one settings form submission through the Convex preference mutation. */
function submitCurriculumPreference({
  locale,
  programs,
  setPreferredCurriculum,
  value,
}: {
  locale: PublicAppLocale;
  programs: readonly CurriculumProgramOption[];
  setPreferredCurriculum: SavePreferredCurriculum;
  value: unknown;
}) {
  return Effect.gen(function* () {
    const formValue = yield* Schema.decodeUnknownEffect(
      Schema.Struct({
        preferredCurriculumProgramKey: Schema.String.pipe(
          Schema.check(Schema.isMinLength(1))
        ),
      })
    )(value).pipe(
      Effect.mapError(
        (cause) => new CurriculumPreferenceValidationError({ cause })
      )
    );
    const program = Arr.findFirst(
      programs,
      (candidate) => candidate.key === formValue.preferredCurriculumProgramKey
    );
    if (Option.isNone(program)) {
      return yield* new CurriculumPreferenceValidationError({
        cause: formValue.preferredCurriculumProgramKey,
      });
    }
    yield* Effect.tryPromise({
      try: () =>
        setPreferredCurriculum({
          locale,
          preferredCurriculumProgramKey:
            formValue.preferredCurriculumProgramKey,
        }),
      catch: (cause) => new CurriculumPreferenceMutationError({ cause }),
    }).pipe(
      Effect.flatMap((result) =>
        Effect.fromResult(result).pipe(
          Effect.mapError(
            (cause) => new CurriculumPreferenceMutationError({ cause })
          )
        )
      )
    );
    return null;
  });
}
