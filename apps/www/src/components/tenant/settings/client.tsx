import { QueryResult, useMutation } from "@confect/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import type { GrantScope } from "@repo/backend/confect/access/schema";
import { IntegrationName } from "@repo/backend/confect/integrations/schema";
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
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import {
  IntegrationAction,
  toggleAction,
} from "@/components/tenant/settings/actions";
import { updateClientChange } from "@/components/tenant/settings/edits";
import { saveSchool } from "@/components/tenant/settings/save";
import { SelectField } from "@/components/tenant/settings/select";
import type { Client } from "@/components/tenant/settings/state";

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
}: {
  onIssued: (secret: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const viewer = useViewerQuery();
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
  // Each choice carries the scope it sends, so the whole school never travels as a unit ID.
  const scopeItems = [
    {
      label: t("grant-scope-school"),
      scope: { kind: "tenant" } satisfies GrantScope,
      value: "school",
    },
    ...Arr.map(units, (unit) => ({
      label: unit.name,
      scope: { kind: "unit", unitId: unit.id } satisfies GrantScope,
      value: unit.id,
    })),
  ];
  const clientName = Schema.decodeOption(IntegrationName)(name.trim());

  const submit = () => {
    const held = [...actions];
    const covered = Arr.findFirst(scopeItems, (item) => item.value === scope);
    if (
      Option.isNone(clientName) ||
      Option.isNone(covered) ||
      !Arr.isArrayNonEmpty(held)
    ) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () =>
          create({
            actions: held,
            name: clientName.value,
            scope: covered.value.scope,
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
            aria-busy={isPending || undefined}
            disabled={Option.isNone(clientName)}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            <Spinner icon={Add01Icon} isLoading={isPending} />
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
        <SelectField
          items={scopeItems}
          label={t("client-scope")}
          onChoose={setScope}
          value={scope}
        />
        <ClientActionsField actions={actions} setActions={setActions} />
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/** The actions a client holds, all checkable; a client always keeps one, so the last stays checked. */
function ClientActionsField({
  actions,
  setActions,
}: {
  actions: readonly IntegrationAction[];
  setActions: (
    change: (
      current: readonly IntegrationAction[]
    ) => readonly IntegrationAction[]
  ) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const id = useId();

  return (
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
                  setActions((current) => toggleAction(current, action, next))
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
  );
}

/**
 * The dialog that changes a client's name and the actions it holds. Its scope and its secret stay,
 * so what connects with it keeps working. The row shows the change at once, and a refusal takes it
 * back.
 */
export function SchoolClientEditDialog({
  client,
  open,
  setOpen,
}: {
  client: Client;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const update = useMutation(integrations.clients.update).withOptimisticUpdate(
    updateClientChange
  );
  // The fields hold what the admin chose, and the client's own values until they choose.
  const [typedName, setName] = useState<string | null>(null);
  const [chosenActions, setActions] = useState<
    readonly IntegrationAction[] | null
  >(null);
  const name = typedName ?? client.name;
  const actions =
    chosenActions ?? Arr.filter(client.actions, Schema.is(IntegrationAction));
  const clientName = Schema.decodeOption(IntegrationName)(name.trim());

  const save = () => {
    const held = [...actions];
    if (Option.isNone(clientName) || !Arr.isArrayNonEmpty(held)) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          update({
            actions: held,
            clientId: client.id,
            name: clientName.value,
            slug,
          }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("client-edit-description")}
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
            onClick={save}
            type="button"
          >
            {t("save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("client-edit")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("client-name")}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("client-name-placeholder")}
            value={name}
          />
        </Field>
        <ClientActionsField
          actions={actions}
          setActions={(change) => setActions(change(actions))}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}
