import { useMutation } from "@confect/react";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { renameLoginChange } from "@/components/tenant/settings/accounts";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Login } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/login";

/**
 * The dialog that changes the login name a student signs in with on the school's host. The field starts from the
 * login's name and is read as the school stores it, lowercase and without spaces around it, and Save waits for a new
 * one. Save closes the dialog at once and the row shows the name at once; a name that another person holds, or that
 * the school cannot hold, goes back with its own toast. The card and the password stay as they are. Each opening is a
 * dialog of its own, so its field starts fresh.
 */
export function LoginRenameDialog({
  login,
  open,
  setOpen,
}: {
  login: Login;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const rename = useMutation(identity.logins.rename).withOptimisticUpdate(
    renameLoginChange
  );
  const [loginName, setLoginName] = useState(login.loginName);
  const next = loginName.trim().toLowerCase();
  const canSave = next !== "" && next !== login.loginName;

  const save = () => {
    if (!canSave) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () => rename({ loginName: next, personId: login.person.id, slug }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("login-rename-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!canSave} onClick={save} type="button">
            {t("login-rename-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={login.person.name}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-login`}>
            {t("card-login-name")}
          </FieldLabel>
          <Input
            id={`${id}-login`}
            onChange={(event) => setLoginName(event.target.value)}
            value={loginName}
          />
          <FieldDescription>{t("student-login-rule")}</FieldDescription>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
