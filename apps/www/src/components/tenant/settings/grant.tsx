import { useMutation } from "@confect/react";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole, OwnerRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { roleIcon } from "@/components/tenant/roles";
import { assignGrantChange } from "@/components/tenant/settings/grants";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/grant";

/**
 * The roles the viewer may give a person. The Integration role belongs to an integration client
 * alone, and only an Owner gives the two roles that lead the school.
 */
export const givenRoles = (viewer: Option.Option<BuiltinRole>) =>
  Arr.filter(
    BuiltinRole.literals,
    (role) =>
      role !== "integration" &&
      (Option.contains(viewer, "owner") || !Schema.is(OwnerRole)(role))
  );

/**
 * The dialog that gives a role of the whole school to a person: one the viewer chooses, or the `person` that the
 * dialog was opened for, such as a member's row, who shows by name. The request goes out first, and the dialog closes
 * at once, so the grant shows in the table.
 */
export function SchoolGrantDialog({
  open,
  person,
  setOpen,
}: {
  open: boolean;
  /** The person the dialog gives the role to, in place of the picker. */
  person?: { readonly id: PersonId; readonly name: string };
  setOpen: (open: boolean) => void;
}) {
  const { role: viewerRole, slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const assign = useMutation(access.grants.assign).withOptimisticUpdate(
    assignGrantChange
  );
  const [chosen, setChosen] = useState<PersonId | undefined>(undefined);
  const personId = person?.id ?? chosen;
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);
  // The grant's person and role stay selected until the server accepts it, and the submit waits for it.
  const [isPending, startAssigning] = useTransition();

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
                    setChosen(undefined);
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
          {person === undefined ? (
            <SchoolPersonPicker
              id={`${id}-person`}
              onChoose={setChosen}
              personId={chosen}
            />
          ) : (
            <Input
              dir="auto"
              id={`${id}-person`}
              placeholder={t("grant-person")}
              readOnly
              value={person.name}
            />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>{t("grant-role")}</FieldLabel>
          <SchoolRoleSelect
            id={`${id}-role`}
            onChoose={setRole}
            roles={givenRoles(viewerRole)}
            value={role}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The role picker of a person: each role by its name and its own icon. `roles` names what the
 * person may be given.
 */
export function SchoolRoleSelect({
  id,
  onChoose,
  roles,
  value,
}: {
  id: string;
  onChoose: (role: BuiltinRole) => void;
  roles: readonly BuiltinRole[];
  value: BuiltinRole | undefined;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const roleItems = Arr.map(roles, (role) => ({
    label: tSchool(`role.${role}`),
    value: role,
  }));

  return (
    <Select
      items={roleItems}
      onValueChange={(next) => {
        const chosen = Schema.decodeUnknownOption(BuiltinRole)(next);
        if (Option.isSome(chosen)) {
          onChoose(chosen.value);
        }
      }}
      value={value}
    >
      <SelectTrigger className="w-full" id={id}>
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
  );
}
