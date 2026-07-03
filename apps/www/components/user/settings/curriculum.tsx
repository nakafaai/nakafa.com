"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { FormBlock } from "@/components/shared/form-block";
import { reportClientException } from "@/lib/analytics/client";

interface CurriculumProgramOption {
  countryCode?: string;
  key: string;
  title: string;
}
type SavePreferredCurriculum = (args: {
  locale: Locale;
  preferredCurriculumProgramKey: string;
}) => Promise<unknown>;

const formSchema = Schema.standardSchemaV1(
  Schema.Struct({
    preferredCurriculumProgramKey: Schema.String.pipe(Schema.minLength(1)),
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

/** Renders the settings form that saves the user's preferred curriculum. */
export function UserSettingsCurriculum() {
  const locale = useLocale();
  const programs = useQueryWithStatus(
    api.learningPreferences.queries.listCurriculumPrograms,
    { locale }
  );
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrent,
    { locale }
  );

  if (!(programs.isSuccess && preference.isSuccess)) {
    return null;
  }

  return (
    <UserSettingsCurriculumForm
      initialProgramKey={preference.data?.preferredCurriculumProgramKey ?? ""}
      key={preference.data?.preferredCurriculumProgramKey ?? "empty"}
      programs={programs.data}
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
  const setPreferredCurriculum = useMutation(
    api.learningPreferences.mutations.setPreferredCurriculum
  );
  const selectItems = programs.map((program) => ({
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
      const result = await Effect.runPromise(
        submitCurriculumPreference({
          locale,
          programs,
          setPreferredCurriculum,
          value,
        })
      );

      if (result.status === "error") {
        const message =
          result.messageKey === "curriculum-invalid-selection"
            ? t("curriculum-invalid-selection")
            : t("curriculum-save-error");

        toast.error(message);
        return;
      }

      form.reset(value);
      toast.success(t("curriculum-save-success"));
    },
  });

  return (
    <form action={() => form.handleSubmit()} id="user-settings-curriculum-form">
      <FormBlock
        description={t("curriculum-description")}
        footer={
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
        }
        title={t("curriculum")}
      >
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
                    {programs.map((program) => (
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
      </FormBlock>
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
  locale: Locale;
  programs: readonly CurriculumProgramOption[];
  setPreferredCurriculum: SavePreferredCurriculum;
  value: unknown;
}) {
  return Effect.gen(function* () {
    const formValue = yield* Schema.decodeUnknown(
      Schema.Struct({
        preferredCurriculumProgramKey: Schema.String.pipe(Schema.minLength(1)),
      })
    )(value).pipe(
      Effect.mapError(
        (cause) => new CurriculumPreferenceValidationError({ cause })
      )
    );
    const program = programs.find(
      (candidate) => candidate.key === formValue.preferredCurriculumProgramKey
    );

    if (!program) {
      return yield* Effect.fail(
        new CurriculumPreferenceValidationError({
          cause: formValue.preferredCurriculumProgramKey,
        })
      );
    }

    yield* Effect.tryPromise({
      try: () =>
        setPreferredCurriculum({
          locale,
          preferredCurriculumProgramKey:
            formValue.preferredCurriculumProgramKey,
        }),
      catch: (cause) => new CurriculumPreferenceMutationError({ cause }),
    });

    return { status: "success" as const };
  }).pipe(
    Effect.catchTags({
      CurriculumPreferenceMutationError: (error) =>
        reportClientException(error, {
          source: "user-settings-curriculum",
        }).pipe(
          Effect.as({
            messageKey: "curriculum-save-error",
            status: "error" as const,
          })
        ),
      CurriculumPreferenceValidationError: () =>
        Effect.succeed({
          messageKey: "curriculum-invalid-selection",
          status: "error" as const,
        }),
    })
  );
}
