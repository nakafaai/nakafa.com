"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  Email,
  InvitedRole,
  PersonName,
} from "@repo/backend/confect/tenancy/schema";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { addMemberChange } from "@/components/tenant/settings/members.client";
import { cardOffered } from "@/components/tenant/settings/offer";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/invite";

/** The languages an invite may be written in: the active ones of the app. */
const localeItems = Arr.map(
  Arr.filter(languages, (language) =>
    Arr.contains(ACTIVE_APP_LOCALE_CODES, language.value)
  ),
  (language) => ({ label: language.label, value: language.value })
);

/** The roles an invite gives, each with the label the school shows for it. */
type InvitedRoleValue = typeof InvitedRole.Type;

/**
 * Renders the dialog that adds a teacher or an Admin: the name, the email, the role,
 * and the language of the email, which starts as the language of the school's first
 * active unit. Only an Owner is offered the Admin role. The Person, its role, and its
 * invite are written in one step, and the row shows in the members and the invitations
 * at once.
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
  const tSchool = useTranslations("School");
  const common = useTranslations("Common");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const viewer = useQuery(tenancy.viewer.get, isSettled ? { slug } : "skip");
  const invite = useMutation(tenancy.roster.invite).withOptimisticUpdate(
    addMemberChange
  );
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitedRoleValue>("teacher");
  const [chosenLocale, setChosenLocale] = useState<
    typeof ActiveAppLocaleCodeSchema.Type | undefined
  >(undefined);

  const canGiveAdmin =
    QueryResult.isSuccess(viewer) &&
    Arr.contains(viewer.value.can, "owner.manage");
  const roleItems = Arr.map(
    Arr.filter(
      InvitedRole.literals,
      (value) => value !== "admin" || canGiveAdmin
    ),
    (value) => ({ label: tSchool(`role.${value}`), value })
  );
  const defaultLocale = QueryResult.isSuccess(viewer)
    ? Option.flatMap(
        Arr.findFirst(viewer.value.units, (unit) => unit.status === "active"),
        (unit) =>
          Schema.decodeOption(ActiveAppLocaleCodeSchema)(unit.contentLanguage)
      )
    : Option.none();
  const parsedName = Schema.decodeOption(PersonName)(name.trim());
  const parsedEmail = Schema.decodeOption(Email)(email.trim());
  const parsedLocale = Option.orElse(
    Option.fromNullishOr(chosenLocale),
    () => defaultLocale
  );
  const submittable =
    Option.isSome(parsedName) &&
    Option.isSome(parsedEmail) &&
    Option.isSome(parsedLocale);

  return (
    <ResponsiveDialog
      description={t("invite-dialog-description")}
      footer={
        <>
          <p className="mr-auto text-muted-foreground text-sm">
            {t("invite-footer")}
          </p>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={!submittable}
            inert={isPending}
            onClick={() => {
              if (
                Option.isNone(parsedName) ||
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
                      name: parsedName.value,
                      role,
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
          <FieldLabel htmlFor={`${id}-name`}>{t("invite-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-email`}>{t("invite-email")}</FieldLabel>
          <Input
            id={`${id}-email`}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <FieldDescription>
            {cardOffered([role])
              ? t("invite-google-note")
              : t("invite-google-admin-note")}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>{t("invite-role")}</FieldLabel>
          <Select
            items={roleItems}
            onValueChange={(value) => {
              const chosen = Schema.decodeUnknownOption(InvitedRole)(value);
              if (Option.isSome(chosen)) {
                setRole(chosen.value);
              }
            }}
            value={role}
          >
            <SelectTrigger className="w-full" id={`${id}-role`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(roleItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
