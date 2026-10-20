"use client";

import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import { QueryResult, useQuery } from "@confect/react";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
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
import { toast } from "@repo/design-system/lib/toast/notify";
import { useForm } from "@tanstack/react-form";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useRef } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { CardSection } from "@/components/shared/card/section";
import { CountryFlagIcon } from "@/components/shared/flag";
import { SettingsFormFooter } from "@/components/user/settings/save";
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
  initialPreference:
    | Ref.Returns<typeof learningPreferences.queries.getCurrent>
    | undefined;
  initialPrograms: Ref.Returns<
    typeof learningPreferences.queries.listCurriculumPrograms
  >;
  locale: ActiveAppLocaleCode;
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
/**
 * Owns the curriculum preference form state after Convex data is ready. A save
 * does not wait: the new choice is the form's saved one at once and the
 * optimistic update shows it everywhere, so Save has nothing left to save. A
 * refused save, the server's or a choice that left the list, brings the stored
 * choice back as the saved one and keeps the newest choice, so Save offers it
 * again beside the error toast. A refusal that a later save overtook leaves the
 * form to that save.
 */
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
  const latestSave = useRef(0);
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
    onSubmit: ({ value, formApi }) => {
      if (!isActiveLocale(locale)) {
        return;
      }
      const stored =
        formApi.options.defaultValues?.preferredCurriculumProgramKey;
      const save = latestSave.current + 1;
      latestSave.current = save;
      // The new choice is the saved one at once, so Save has nothing to save.
      formApi.reset(value);
      const restore = Effect.sync(() => {
        toast.error({
          description: "action-error.description",
          title: "action-error.title",
        });
        if (save !== latestSave.current) {
          return;
        }
        // The stored choice comes back as the saved one, and the newest
        // choice stays, so Save offers it again.
        const chosen = formApi.getFieldMeta("preferredCurriculumProgramKey")
          ?.isTouched
          ? formApi.getFieldValue("preferredCurriculumProgramKey")
          : value.preferredCurriculumProgramKey;
        formApi.reset({ preferredCurriculumProgramKey: stored ?? "" });
        formApi.setFieldValue("preferredCurriculumProgramKey", chosen);
      });
      const refuseInvalid = () => restore;
      const reportFailure = (error: CurriculumPreferenceMutationError) =>
        reportClientException(error, {
          source: "user-settings-curriculum",
        }).pipe(Effect.andThen(restore));
      Effect.runPromise(
        submitCurriculumPreference({
          locale,
          programs,
          setPreferredCurriculum,
          value,
        }).pipe(
          Effect.catchTags({
            CurriculumPreferenceMutationError: reportFailure,
            CurriculumPreferenceValidationError: refuseInvalid,
          })
        )
      );
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
        <SettingsFormFooter form={form} hint={t("curriculum-footer")} />
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
  locale: ActiveAppLocaleCode;
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
