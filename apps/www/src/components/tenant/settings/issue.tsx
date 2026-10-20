import { useMutation } from "@confect/react";
import identity from "@repo/backend/confect/_generated/refs/identity";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
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
  const login = loginName.trim().toLowerCase();

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
            disabled={login === ""}
            onClick={() => {
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () => issue({ loginName: login, personId, slug }),
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
      title={t("card-issue-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-login`}>
            {t("card-login-name")}
          </FieldLabel>
          <Input
            id={`${id}-login`}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder={t("card-login-name-placeholder")}
            value={loginName}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
