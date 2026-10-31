import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  CheckmarkCircle02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodName } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DatePicker } from "@repo/design-system/components/ui/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
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
import { saveSchool } from "@/components/tenant/settings/save";
import { isDraft, type Period } from "@/components/tenant/settings/state";
import {
  archivePeriodChange,
  editPeriodChange,
  openPeriodChange,
  restorePeriodChange,
} from "@/components/tenant/settings/terms";

const SOURCE = "components/tenant/settings/period";

/**
 * The restore action of an archived period in the archived list. The period shows as active at
 * once, and a refusal, such as another active period of its unit, takes it back.
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

  return (
    <div className="flex justify-end">
      <Button
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ periodId: period.id, slug }), SOURCE)
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        {t("period-restore")}
      </Button>
    </div>
  );
}

/** The name and the two dates of a period, as its dialog holds them. */
type PeriodFields = Pick<Period, "end" | "name" | "start">;

/**
 * A period's row menu: it edits the period's name and dates in the dialog that adds a period, filled in, then opens a
 * planned period or archives an active one. An archived period has no menu, because the server refuses every write to
 * it, so its cell stays empty.
 */
export function SchoolPeriodMenu({
  period,
  slug,
}: {
  period: Period;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
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
  const [isEditing, setIsEditing] = useState(false);
  // Each opening starts the dialog again from the period as it is now.
  const [opening, setOpening] = useState(0);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(period.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setOpening((count) => count + 1);
              setIsEditing(true);
            }}
          >
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
          {period.status === "active" ? (
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
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <PeriodDialog
        description={t("period-edit-description")}
        fields={period}
        key={opening}
        onSave={(fields) =>
          startTransition(() =>
            saveSchool(
              () => edit({ ...fields, periodId: period.id, slug }),
              SOURCE
            )
          )
        }
        open={isEditing}
        saveLabel={t("period-edit-save")}
        setOpen={setIsEditing}
        title={t("period-edit")}
      />
    </div>
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
