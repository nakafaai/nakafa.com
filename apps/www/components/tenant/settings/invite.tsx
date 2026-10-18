"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Email } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { inviteChange } from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/invite";

/** How many unclaimed people one page of the invite list loads, and each page after it. */
const PERSON_PAGE_SIZE = 100;

/** The languages an invite may be written in: the active ones of the app. */
const localeItems = Arr.map(
  Arr.filter(languages, (language) =>
    Arr.contains(ACTIVE_APP_LOCALE_CODES, language.value)
  ),
  (language) => ({ label: language.label, value: language.value })
);

/**
 * Renders the dialog that invites a Person of the school who has no account yet. It
 * takes the Person, the email, and the language of the email, which starts as the
 * language of the school's first active unit. The invite appears in the list at once.
 */
export function SchoolInviteDialog({
  open,
  setOpen,
  slug,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const people = usePaginatedQuery(
    tenancy.people.list,
    { account: "unclaimed", slug, status: "active" },
    { initialNumItems: PERSON_PAGE_SIZE }
  );
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const invite = useMutation(tenancy.invites.invite).withOptimisticUpdate(
    inviteChange
  );
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [personId, setPersonId] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [chosenLocale, setChosenLocale] = useState<
    typeof ActiveAppLocaleCodeSchema.Type | undefined
  >(undefined);

  if (PaginatedQueryResult.isFailure(people)) {
    throw people.error;
  }

  const personItems = Arr.map(people.results, (person) => ({
    label: person.name,
    value: person.id,
  }));
  const noneLeft =
    PaginatedQueryResult.isExhausted(people) && people.results.length === 0;
  const defaultLocale = QueryResult.isSuccess(viewer)
    ? Option.flatMap(
        Arr.findFirst(viewer.value.units, (unit) => unit.status === "active"),
        (unit) =>
          Schema.decodeOption(ActiveAppLocaleCodeSchema)(unit.contentLanguage)
      )
    : Option.none();
  const parsedPerson = Option.flatMap(Option.fromNullishOr(personId), (value) =>
    Schema.decodeUnknownOption(Id("tenantPeople"))(value)
  );
  const parsedEmail = Schema.decodeOption(Email)(email.trim());
  const parsedLocale = Option.orElse(
    Option.fromNullishOr(chosenLocale),
    () => defaultLocale
  );

  return (
    <ResponsiveDialog
      description={t("invite-dialog-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={
              Option.isNone(parsedPerson) ||
              Option.isNone(parsedEmail) ||
              Option.isNone(parsedLocale)
            }
            inert={isPending}
            onClick={() => {
              if (
                Option.isNone(parsedPerson) ||
                Option.isNone(parsedEmail) ||
                Option.isNone(parsedLocale)
              ) {
                return;
              }
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () =>
                    invite({
                      email: parsedEmail.value,
                      locale: parsedLocale.value,
                      personId: parsedPerson.value,
                      slug,
                    }),
                  SOURCE
                )
              );
            }}
            type="button"
          >
            {t("invite-submit")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("invite-dialog-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-person`}>{t("invite-person")}</FieldLabel>
          <Select
            items={personItems}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setPersonId(value);
              }
            }}
            value={personId}
          >
            <SelectTrigger className="w-full" id={`${id}-person`}>
              <SelectValue placeholder={t("invite-person-placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(personItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {PaginatedQueryResult.isCanLoadMore(people) ? (
                <Intersection
                  onIntersect={() => people.loadMore(PERSON_PAGE_SIZE)}
                />
              ) : null}
            </SelectContent>
          </Select>
          {noneLeft ? (
            <FieldDescription>{t("invite-none-left")}</FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-email`}>{t("invite-email")}</FieldLabel>
          <Input
            id={`${id}-email`}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-locale`}>{t("invite-locale")}</FieldLabel>
          <Select
            items={localeItems}
            onValueChange={(value) => {
              const chosen = Schema.decodeUnknownOption(
                ActiveAppLocaleCodeSchema
              )(value);
              if (Option.isSome(chosen)) {
                setChosenLocale(chosen.value);
              }
            }}
            value={Option.getOrUndefined(parsedLocale)}
          >
            <SelectTrigger className="w-full" id={`${id}-locale`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(localeItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
