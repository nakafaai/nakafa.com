"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { IntegrationName } from "@repo/backend/confect/integrations/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
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
  const common = useTranslations("Common");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const viewer = useQuery(tenancy.viewer.get, isSettled ? { slug } : "skip");
  const create = useMutation(integrations.clients.create);
  const id = useId();
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
  const clientName = Schema.decodeOption(IntegrationName)(name.trim());

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
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={Option.isNone(clientName)}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("client-create")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("client-add")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("client-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("client-name-placeholder")}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-scope`}>{t("client-scope")}</FieldLabel>
          <Select
            items={scopeItems}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setScope(value);
              }
            }}
            value={scope}
          >
            <SelectTrigger className="w-full" id={`${id}-scope`}>
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
        <FieldSet>
          <FieldLegend variant="label">{t("client-actions")}</FieldLegend>
          <FieldGroup data-slot="checkbox-group">
            {Arr.map(IntegrationAction.literals, (action) => {
              const checked = Arr.contains(actions, action);
              return (
                <Field key={action} orientation="horizontal">
                  <Checkbox
                    checked={checked}
                    disabled={checked && actions.length === 1}
                    id={`${id}-action-${action}`}
                    onCheckedChange={(next) =>
                      setActions((current) =>
                        toggleAction(current, action, next)
                      )
                    }
                  />
                  <FieldLabel htmlFor={`${id}-action-${action}`}>
                    {t(`client-action.${action}`)}
                  </FieldLabel>
                </Field>
              );
            })}
          </FieldGroup>
          <FieldDescription>{t("client-actions-footer")}</FieldDescription>
        </FieldSet>
      </FieldGroup>
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
