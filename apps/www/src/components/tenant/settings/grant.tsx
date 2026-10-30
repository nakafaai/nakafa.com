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
import { assignGrantChange } from "@/components/tenant/settings/mutation";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/grant";

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
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
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
