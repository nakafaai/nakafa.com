import { useMutation } from "@confect/react";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { roleIcon } from "@/components/tenant/roles";
import { assignGrantChange } from "@/components/tenant/settings/mutation";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/grant";

/**
 * The dialog that gives a role of the whole school to a chosen person. The request
 * goes out first, and the dialog closes at once, so the grant shows in the table.
 */
export function SchoolGrantDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const common = useTranslations("Common");
  const id = useId();
  const assign = useMutation(access.grants.assign).withOptimisticUpdate(
    assignGrantChange
  );
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);
  // The grant's person and role stay selected until the server accepts it, and the submit waits for it.
  const [isPending, startAssigning] = useTransition();

  const roleItems = Arr.map(BuiltinRole.literals, (value) => ({
    label: tSchool(`role.${value}`),
    value,
  }));

  return (
    <ResponsiveDialog
      description={t("roles-assign-description")}
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
            disabled={personId === undefined || role === undefined || isPending}
            inert={isPending}
            onClick={() => {
              if (personId === undefined || role === undefined) {
                return;
              }
              setOpen(false);
              startAssigning(() =>
                saveSchool(
                  () =>
                    assign({
                      personId,
                      role,
                      scope: { kind: "tenant" },
                      slug,
                    }),
                  SOURCE,
                  () => {
                    setPersonId(undefined);
                    setRole(undefined);
                  }
                )
              );
            }}
            type="button"
          >
            {t("roles-assign")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("roles-assign-dialog")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-person`}>{t("grant-person")}</FieldLabel>
          <SchoolPersonPicker
            id={`${id}-person`}
            onChoose={setPersonId}
            personId={personId}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>{t("grant-role")}</FieldLabel>
          <Select
            items={roleItems}
            onValueChange={(value) => {
              const chosen = Schema.decodeUnknownOption(BuiltinRole)(value);
              if (Option.isSome(chosen)) {
                setRole(chosen.value);
              }
            }}
            value={role}
          >
            <SelectTrigger className="w-full" id={`${id}-role`}>
              <SelectValue placeholder={t("roles-role-placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(roleItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <HugeIcons icon={roleIcon(item.value)} />
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
