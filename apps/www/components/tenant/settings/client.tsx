"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { UnitName } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
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
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  IntegrationAction,
  toggleAction,
} from "@/components/tenant/settings/actions";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/client";

/**
 * Renders the dialog that creates an integration client of the school: its name, the
 * part of the school it covers, and the actions it holds, all checked at first. The
 * create button stays as it is while the request runs. The secret the server answers
 * goes to `onIssued`, and the dialog closes.
 */
export function SchoolClientCreateDialog({
  onIssued,
  open,
  setOpen,
  slug,
}: {
  onIssued: (secret: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const create = useMutation(integrations.clients.create);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("school");
  const [actions, setActions] = useState<readonly IntegrationAction[]>(
    IntegrationAction.literals
  );

  const units = QueryResult.isSuccess(viewer)
    ? Arr.filter(viewer.value.units, (unit) => unit.status === "active")
    : [];
  const scopeItems = [
    { label: t("grant-scope-school"), value: "school" },
    ...Arr.map(units, (unit) => ({ label: unit.name, value: unit.id })),
  ];
  const clientName = Schema.decodeOption(UnitName)(name.trim());

  const submit = () => {
    const held = [...actions];
    if (Option.isNone(clientName) || !Arr.isArrayNonEmpty(held)) {
      return;
    }
    const covered = scopeOf(scope);
    startTransition(() =>
      saveSchool(
        () =>
          create({
            actions: held,
            name: clientName.value,
            scope: covered,
            slug,
          }),
        SOURCE,
        (issued) => {
          setOpen(false);
          onIssued(issued.secret);
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("client-add-description")}
      footer={
        <Button
          disabled={Option.isNone(clientName)}
          inert={isPending}
          onClick={submit}
          type="button"
        >
          {t("client-create")}
        </Button>
      }
      open={open}
      setOpen={setOpen}
      title={t("client-add")}
    >
      <Field>
        <FieldLabel>{t("client-name")}</FieldLabel>
        <Input
          onChange={(event) => setName(event.target.value)}
          placeholder={t("client-name-placeholder")}
          value={name}
        />
      </Field>
      <Field>
        <FieldLabel>{t("client-scope")}</FieldLabel>
        <Select
          items={scopeItems}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setScope(value);
            }
          }}
          value={scope}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Arr.map(scopeItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("client-actions")}</FieldLabel>
        {Arr.map(IntegrationAction.literals, (action) => {
          const checked = Arr.contains(actions, action);
          return (
            <div className="flex items-center gap-2" key={action}>
              <Checkbox
                checked={checked}
                disabled={checked && actions.length === 1}
                id={`client-action-${action}`}
                onCheckedChange={(next) =>
                  setActions((current) => toggleAction(current, action, next))
                }
              />
              <label
                className="cursor-pointer text-sm"
                htmlFor={`client-action-${action}`}
              >
                {t(`client-action.${action}`)}
              </label>
            </div>
          );
        })}
        <p className="text-muted-foreground text-sm">
          {t("client-actions-footer")}
        </p>
      </Field>
    </ResponsiveDialog>
  );
}

/** The part of the school a client covers: the whole school, or the unit the choice names. */
function scopeOf(choice: string): GrantScope {
  return Option.match(Schema.decodeUnknownOption(Id("tenantUnits"))(choice), {
    onNone: (): GrantScope => ({ kind: "tenant" }),
    onSome: (unitId): GrantScope => ({ kind: "unit", unitId }),
  });
}
