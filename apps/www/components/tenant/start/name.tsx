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
} from "@repo/design-system/components/ui/questionnaire";
import { MAIN_DOMAIN } from "@repo/next-config/domains";
import { Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useStore } from "zustand";
import { useStart } from "@/components/tenant/start/context";
import { START_NAME_LIMIT } from "@/components/tenant/start/state";

/** How long the address waits after the last keystroke before the server checks it. */
const CHECK_DELAY_MILLISECONDS = 250;

/** Whether a typed name can name a school once its edges are trimmed. */
const isSchoolName = Schema.is(TenantName);

/**
 * The first question: the school's name, and its address, which follows the name
 * until the founder types one. The server checks the address while the founder
 * types, and a taken or reserved address keeps the questionnaire here with its
 * reason. A free address shows a check inside the field.
 */
export function StartNameQuestion() {
  const t = useTranslations("SchoolStart");
  const { typed } = useStart();
  const name = useStore(typed, (state) => state.name);
  const slug = useStore(typed, (state) => state.slug);
  const setName = useStore(typed, (state) => state.setName);
  const setSlug = useStore(typed, (state) => state.setSlug);
  const [asked] = useDebouncedValue(slug, CHECK_DELAY_MILLISECONDS);
  const check = useQuery(
    tenancy.start.address,
    asked === "" ? "skip" : { slug: asked }
  );
  const nameId = useId();
  const slugId = useId();
  if (QueryResult.isFailure(check)) {
    throw check.error;
  }
  const state =
    asked === slug && QueryResult.isSuccess(check)
      ? Option.some(check.value)
      : Option.none();
  const nameProblem = name.trim() !== "" && !isSchoolName(name.trim());
  const addressProblem =
    (name.trim() !== "" && slug === "") ||
    Option.exists(state, (answer) => answer !== "free");
  const message = nameProblem
    ? t("name-error")
    : Option.match(state, {
        onNone: () =>
          slug === "" && name.trim() !== ""
            ? t("address-invalid")
            : t("required-error"),
        onSome: (answer) =>
          answer === "free" ? t("required-error") : t(`address-${answer}`),
      });

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
            autoComplete="organization"
            id={nameId}
            maxLength={START_NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("name-placeholder")}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={slugId}>{t("address-label")}</FieldLabel>
          <div className="relative">
            <QuestionnaireInput
              autoCapitalize="none"
              autoComplete="off"
              className="pe-32"
              id={slugId}
              maxLength={63}
              onChange={(event) => setSlug(event.target.value)}
              spellCheck={false}
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
