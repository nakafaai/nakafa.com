import { useMutation } from "@confect/react";
import access from "@repo/backend/confect/_generated/refs/access";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { changeGrantRoleChange } from "@/components/tenant/settings/edits";
import {
  givenRoles,
  SchoolRoleSelect,
} from "@/components/tenant/settings/grant";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Grant } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/roles/change";

/**
 * The dialog that changes the role of one grant, over the same scope, in one step, so the person
 * is never left without a role. The row shows the new role at once, and a refusal puts the old one
 * back.
 */
export function SchoolRoleChangeDialog({
  grant,
  open,
  setOpen,
}: {
  grant: Grant;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { role: viewerRole, slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const change = useMutation(access.grants.change).withOptimisticUpdate(
    changeGrantRoleChange
  );
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);

  return (
    <ResponsiveDialog
      description={t("grant-change-description", { name: grant.person.name })}
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
            disabled={role === undefined}
            onClick={() => {
              if (role === undefined) {
                return;
              }
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () => change({ grantId: grant.id, role, slug }),
                  SOURCE
                )
              );
            }}
            type="button"
          >
            {t("save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("grant-change")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>{t("grant-role")}</FieldLabel>
          <SchoolRoleSelect
            id={`${id}-role`}
            onChoose={setRole}
            roles={Arr.filter(
              givenRoles(viewerRole),
              (candidate) => candidate !== grant.role.key
            )}
            value={role}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
