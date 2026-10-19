"use client";

import { QueryResult, useQuery } from "@confect/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantName } from "@repo/backend/confect/tenancy/schema";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireTitle,
  questionnaireInputVariants,
} from "@repo/design-system/components/ui/questionnaire";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useTypedName } from "@/components/tenant/start/context";
import { START_NAME_LIMIT } from "@/components/tenant/start/state";

/** How long the address waits after the last keystroke before the server checks it. */
const CHECK_DELAY_MILLISECONDS = 250;

/** Whether a typed name can name a school once its edges are trimmed. */
const isSchoolName = Schema.is(TenantName);

/**
 * The first question: the school's name, and its address, which follows the name
 * until the founder types one. The server checks the address while the founder
 * types, and a taken or reserved address keeps the questionnaire here with its
 * reason. A free address shows a check inside the field. The name is the
 * question's answer; the address is a plain field that completes it, because a
 * question that takes one answer hands that answer back and forth between two
 * answer inputs as both fill.
 */
export function StartNameQuestion() {
  const t = useTranslations("SchoolStart");
  const name = useTypedName((state) => state.name);
  const slug = useTypedName((state) => state.slug);
  const setName = useTypedName((state) => state.setName);
  const setSlug = useTypedName((state) => state.setSlug);
  const [asked] = useDebouncedValue(slug, CHECK_DELAY_MILLISECONDS);
  const check = useQuery(
    tenancy.start.address,
    asked === "" ? "skip" : { slug: asked }
  );
  const nameId = useId();
  const slugId = useId();
  const slugLabelId = useId();
  // A failed check keeps the typed name and address in place, and says so beside the field, so
  // the founder types the address again to check it, and nothing is lost.
  const checkFailed = QueryResult.isFailure(check);
  const state =
    asked === slug && QueryResult.isSuccess(check)
      ? Option.some(check.value)
      : Option.none();
  // Once either field holds something, the name is required, so typing an address
  // alone never answers the question.
  const started = name !== "" || slug !== "";
  const nameProblem = started && !isSchoolName(name.trim());
  const addressProblem =
    (started && slug === "") ||
    Option.exists(state, (answer) => answer !== "free");
  const addressMessage =
    checkFailed && asked === slug
      ? t("address-check-failed")
      : Option.match(state, {
          onNone: () =>
            started && slug === "" ? t("address-invalid") : t("required-error"),
          onSome: (answer) =>
            answer === "free" ? t("required-error") : t(`address-${answer}`),
        });
  const message = nameProblem ? t("name-error") : addressMessage;

  return (
    <QuestionnaireItem
      invalid={nameProblem || addressProblem}
      name="name"
      required
    >
      <QuestionnaireTitle>{t("name-title")}</QuestionnaireTitle>
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={nameId}>{t("name-label")}</FieldLabel>
          <QuestionnaireInput
            aria-invalid={nameProblem}
            autoComplete="organization"
            id={nameId}
            maxLength={START_NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("name-placeholder")}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={slugId} id={slugLabelId}>
            {t("address-label")}
          </FieldLabel>
          <div className="relative">
            <input
              aria-invalid={addressProblem}
              aria-labelledby={slugLabelId}
              autoCapitalize="none"
              autoComplete="off"
              className={questionnaireInputVariants({ className: "pe-32" })}
              id={slugId}
              maxLength={63}
              onChange={(event) => setSlug(event.target.value)}
              spellCheck={false}
              type="text"
              value={slug}
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center gap-1.5 text-muted-foreground text-sm">
              {Option.contains(state, "free") ? (
                <>
                  <HugeIcons
                    aria-hidden="true"
                    className="size-4 text-primary"
                    icon={CheckmarkCircle02Icon}
                  />
                  <span className="sr-only">{t("address-free")}</span>
                </>
              ) : null}
              <span aria-hidden="true">.{MAIN_DOMAIN}</span>
            </span>
          </div>
        </Field>
      </FieldGroup>
      <QuestionnaireError>{message}</QuestionnaireError>
    </QuestionnaireItem>
  );
}
