import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodName } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DatePicker } from "@repo/design-system/components/ui/date";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import {
  ConfirmRowMenu,
  ConfirmSubject,
} from "@/components/shared/table/confirm";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Period } from "@/components/tenant/settings/state";
import {
  archivePeriodChange,
  editPeriodChange,
  openPeriodChange,
  removePeriodChange,
  restorePeriodChange,
} from "@/components/tenant/settings/terms";

const SOURCE = "components/tenant/settings/period";

/**
 * The menu of an archived period in the archived list: Restore, which shows the period as active at once and takes it
 * back on a refusal, such as another active period of its unit, and Delete for a period nothing uses.
 */
export function SchoolPeriodRestore({
  period,
  slug,
}: {
  period: Period;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const restore = useMutation(tenancy.periods.restore).withOptimisticUpdate(
    restorePeriodChange
  );
  const remove = usePeriodDelete(period, slug);

  return (
    <ConfirmRowMenu {...remove}>
      <DropdownMenuItem
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ periodId: period.id, slug }), SOURCE)
          )
        }
      >
        <HugeIcons icon={ArchiveRestoreIcon} />
        {t("period-restore")}
      </DropdownMenuItem>
    </ConfirmRowMenu>
  );
}

/**
 * What a period's Delete needs, for the menus that end in it: the copy, the period it removes in the confirmation's
 * body, and whether the menu offers it at all. Delete stands only for a period nothing holds, as the list reads it with
 * the server's own rule (the active period, or one that cohorts, classes, grades, a graduation or a promotion point at),
 * so a menu never offers a delete the server refuses. It takes the period out of the list at once.
 */
function usePeriodDelete(period: Period, slug: TenantSlug) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const remove = useMutation(tenancy.periods.remove).withOptimisticUpdate(
    removePeriodChange
  );

  return {
    action: common("delete"),
    confirm: t("period-delete-confirm"),
    description: t("period-delete-description"),
    icon: Delete02Icon,
    offered: period.hold === null,
    onConfirm: () =>
      startTransition(() =>
        saveSchool(
          () => remove({ periodId: period.id, slug }),
          SOURCE,
          () => toast.success({ title: "school-period-deleted.title" })
        )
      ),
    body: <ConfirmSubject icon={Calendar03Icon} name={period.name} />,
    title: t("period-delete-title", { name: period.name }),
  };
}

/** The name and the two dates of a period, as its dialog holds them. */
type PeriodFields = Pick<Period, "end" | "name" | "start">;

/**
 * A period's row menu: it edits the period's name and dates in the dialog that adds a period, filled in, then opens a
 * planned period; under the separator it archives an active one and deletes a period nothing holds (`usePeriodDelete`). An archived period
 * takes `SchoolPeriodRestore` instead, because the server refuses every other write to it.
 */
export function SchoolPeriodMenu({
  period,
  slug,
}: {
  period: Period;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const open = useMutation(tenancy.periods.open).withOptimisticUpdate(
    openPeriodChange
  );
  const archive = useMutation(tenancy.periods.archive).withOptimisticUpdate(
    archivePeriodChange
  );
  const restore = useMutation(tenancy.periods.restore).withOptimisticUpdate(
    restorePeriodChange
  );
  const edit = useMutation(tenancy.periods.edit).withOptimisticUpdate(
    editPeriodChange
  );
  const remove = usePeriodDelete(period, slug);
  // Each opening starts the dialog again from the period as it is now.
  const dialogs = useDialogs<"edit">();

  return (
    <>
      <ConfirmRowMenu
        {...remove}
        footer={
          period.status === "active" ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => archive({ periodId: period.id, slug }),
                    SOURCE,
                    () =>
                      toast.success(
                        { title: "school-period-archived.title" },
                        {
                          action: {
                            label: "undo",
                            onClick: () =>
                              startTransition(() =>
                                saveSchool(
                                  () => restore({ periodId: period.id, slug }),
                                  SOURCE
                                )
                              ),
                          },
                        }
                      )
                  )
                )
              }
            >
              <HugeIcons icon={Archive02Icon} />
              {t("period-archive")}
            </DropdownMenuItem>
          ) : undefined
        }
      >
        <DropdownMenuItem onClick={() => dialogs.show("edit")}>
          <HugeIcons icon={PencilEdit02Icon} />
          {t("period-edit")}
        </DropdownMenuItem>
        {period.status === "planned" ? (
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(() => open({ periodId: period.id, slug }), SOURCE)
              )
            }
          >
            <HugeIcons icon={CheckmarkCircle02Icon} />
            {t("period-open")}
          </DropdownMenuItem>
        ) : null}
      </ConfirmRowMenu>
      {dialogs.kind === "edit" ? (
        <PeriodDialog
          description={t("period-edit-description")}
          fields={period}
          key={dialogs.key}
          onSave={(fields) =>
            startTransition(() =>
              saveSchool(
                () => edit({ ...fields, periodId: period.id, slug }),
                SOURCE
              )
            )
          }
          open={dialogs.isOpen("edit")}
          saveLabel={t("period-edit-save")}
          setOpen={dialogs.setOpen}
          title={t("period-edit")}
        />
      ) : null}
    </>
  );
}

/**
 * The dialog of a period's name and its first and last days, which adds a period and edits one. It starts from
 * `fields` and keeps only what the user changes, and it saves once the name passes the name schema, both days are
 * chosen, and something differs from where it started. It closes as it saves; its caller remounts it to start again.
 */
export function PeriodDialog({
  description,
  fields,
  onSave,
  open,
  saveLabel,
  setOpen,
  title,
}: {
  description: string;
  /** Where the dialog starts: empty for a new period, the period itself for an edit. */
  fields: PeriodFields;
  onSave: (fields: PeriodFields) => void;
  open: boolean;
  saveLabel: string;
  setOpen: (open: boolean) => void;
  title: string;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const [nameChoice, setName] = useState<string | null>(null);
  const [startChoice, setStart] = useState<string | null>(null);
  const [endChoice, setEnd] = useState<string | null>(null);
  const name = nameChoice ?? fields.name;
  const start = startChoice ?? fields.start;
  const end = endChoice ?? fields.end;
  const next = { end, name: name.trim(), start };
  const changed =
    next.name !== fields.name || start !== fields.start || end !== fields.end;
  const canSave =
    changed && Schema.is(PeriodName)(next.name) && start !== "" && end !== "";

  return (
    <ResponsiveDialog
      description={description}
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
            disabled={!canSave}
            onClick={() => {
              setOpen(false);
              onSave(next);
            }}
            type="button"
          >
            {saveLabel}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={title}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("period-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("period-name-placeholder")}
            value={name}
          />
        </Field>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>{t("period-start")}</FieldLabel>
            <DatePicker
              id={`${id}-start`}
              max={end === "" ? undefined : end}
              onValueChange={setStart}
              placeholder={t("period-start-placeholder")}
              value={start}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-end`}>{t("period-end")}</FieldLabel>
            <DatePicker
              id={`${id}-end`}
              min={start === "" ? undefined : start}
              onValueChange={setEnd}
              placeholder={t("period-end-placeholder")}
              value={end}
            />
          </Field>
        </div>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
