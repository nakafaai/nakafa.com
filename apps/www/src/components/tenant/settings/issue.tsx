import { useMutation } from "@confect/react";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { LoginName } from "@repo/backend/confect/identity/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import type { CardView } from "@/components/tenant/settings/card";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/issue";

/**
 * The dialog that gives a teacher or an Admin who has no account yet a login card of their
 * own: the login name is typed, and the card is answered once, to `onIssued`, which opens
 * it. An address without Google signs in with this card.
 */
export function SchoolIssueCardDialog({
  name,
  onIssued,
  open,
  personId,
  setOpen,
  slug,
}: {
  name: string;
  onIssued: (card: CardView) => void;
  open: boolean;
  personId: CardView["personId"];
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const issue = useMutation(identity.cards.issue);
  const [loginName, setLoginName] = useState("");
  const login = Schema.decodeOption(LoginName)(loginName.trim().toLowerCase());
  const problem = loginName.trim() !== "" && Option.isNone(login);

  return (
    <ResponsiveDialog
      description={t("invite-card-description")}
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
            disabled={Option.isNone(login)}
            onClick={() => {
              if (Option.isNone(login)) {
                return;
              }
              const chosen = login.value;
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () => issue({ loginName: chosen, personId, slug }),
                  SOURCE,
                  (card) => onIssued({ ...card, name })
                )
              );
            }}
            type="button"
          >
            {t("invite-card-submit")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("card-issue-action")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-login`}>
            {t("card-login-name")}
          </FieldLabel>
          <Input
            aria-invalid={problem}
            id={`${id}-login`}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder={t("card-login-name-placeholder")}
            value={loginName}
          />
          <FieldDescription>{t("student-login-rule")}</FieldDescription>
          <FieldError>{problem ? t("student-login-rule") : null}</FieldError>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
