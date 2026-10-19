"use client";

import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  EXAM_TITLE_MAX_LENGTH,
  ExamTitle,
} from "@repo/backend/confect/exams/exam";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
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
import {
  Array as Arr,
  Effect,
  Function as Fn,
  Option,
  Schema,
  String as Str,
} from "effect";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition } from "react";
import type { StoreApi } from "zustand";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  choiceKey,
  defaultChoice,
  type ScopeChoice,
  type unitLanguages,
} from "@/components/tenant/exams/create";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { insertDraftExam } from "@/components/tenant/exams/optimistic";
import { placeholderExamId } from "@/components/tenant/exams/placeholder";

/** A language an exam takes, as the create mutation names it. */
type Language = ReturnType<typeof unitLanguages>[number];

/**
 * The button and the dialog that create an exam. The dialog asks for the title, the place,
 * and the language. The new exam shows in the list at once, as a placeholder that is inert
 * until the server answers, and then the page goes to its editor. A refused create leaves
 * the list as it was, and shows the action-error toast.
 */
export function CreateExam({
  choices,
  drafts,
  languages,
  slug,
}: {
  choices: readonly ScopeChoice[];
  drafts: StoreApi<ExamDrafts>;
  languages: readonly Language[];
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const create = useMutation(exams.exams.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [schoolLanguage, setSchoolLanguage] = useState<Language | null>(null);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );
  const unitItems = Arr.map(choices, (current) => ({
    label: current.unitName ?? t("whole-school"),
    value: choiceKey(current),
  }));
  const languageItems = Arr.map(languages, (code) => ({
    label: names.of(code),
    value: code,
  }));

  const choice = Option.orElse(
    Arr.findFirst(choices, (current) => choiceKey(current) === picked),
    () => defaultChoice(choices)
  );
  const language = Option.orElse(
    Option.flatMap(choice, (current) => Option.fromNullishOr(current.language)),
    () =>
      Option.orElse(Option.fromNullishOr(schoolLanguage), () =>
        Arr.head(languages)
      )
  );
  const name = Str.trim(title);
  // A title the schema refuses is either empty or too long: the input is one line, and it is trimmed.
  const titleTooLong = name !== "" && !Schema.is(ExamTitle)(name);
  const ready =
    Option.isSome(choice) &&
    Option.isSome(language) &&
    Schema.is(ExamTitle)(name);
  const isUnitLanguage =
    Option.isSome(choice) && choice.value.language !== null;

  /**
   * Creates the exam, shows it at once, and goes to its editor once the server saves it. The
   * dialog closes at once, and the create button stays inert until the save settles, so a second
   * press during the close cannot save a second exam.
   */
  const submit = () => {
    if (!ready || Option.isNone(choice) || Option.isNone(language)) {
      return;
    }
    const { scope } = choice.value;
    const chosen = language.value;
    setOpen(false);
    startTransition(() =>
      runExamAction(
        placeholderExamId.pipe(
          Effect.flatMap((draftId) => {
            drafts.getState().start(draftId);
            return sentAction(() =>
              create.withOptimisticUpdate(
                insertDraftExam({ id: draftId, language: chosen, title: name })
              )({ language: chosen, scope, slug, title: name })
            ).pipe(
              Effect.ensuring(Effect.sync(() => drafts.getState().end(draftId)))
            );
          }),
          Effect.tap((saved) =>
            Effect.sync(() => router.push(`/exams/${saved.id}/edit`))
          )
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      )
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("create")}</Button>
      <ResponsiveDialog
        description={t("create-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button
              disabled={!ready || isPending}
              inert={isPending}
              onClick={submit}
            >
              {t("create")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("create")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>{t("title-label")}</FieldLabel>
            <Input
              id={`${id}-title`}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("untitled")}
              value={title}
            />
            {name === "" ? (
              <FieldDescription>{t("title-needed")}</FieldDescription>
            ) : null}
            {titleTooLong ? (
              <FieldDescription>
                {t("title-too-long", { count: EXAM_TITLE_MAX_LENGTH })}
              </FieldDescription>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-unit`}>{t("unit")}</FieldLabel>
            <Select
              items={unitItems}
              onValueChange={(key) => setPicked(key)}
              value={Option.getOrNull(Option.map(choice, choiceKey))}
            >
              <SelectTrigger className="w-full" id={`${id}-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(unitItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-language`}>{t("language")}</FieldLabel>
            <Select
              items={languageItems}
              onValueChange={(code) =>
                setSchoolLanguage(
                  Arr.findFirst(languages, (item) => item === code).pipe(
                    Option.getOrNull
                  )
                )
              }
              value={Option.getOrNull(
                Option.map(language, (code): string => code)
              )}
            >
              <SelectTrigger
                className="w-full"
                disabled={isUnitLanguage}
                id={`${id}-language`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(languageItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
