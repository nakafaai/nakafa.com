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
  openPeriodChange,
  renamePeriodChange,
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

/**
 * A period's row menu: it renames the period, then opens a planned period or archives an
 * active one. The rename dialog saves a name that changes the stored one and passes the
 * name schema, then closes. An archived period has no menu, because the server refuses
 * every write to it, so its cell stays empty.
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
  const id = useId();
  const open = useMutation(tenancy.periods.open).withOptimisticUpdate(
    openPeriodChange
  );
  const archive = useMutation(tenancy.periods.archive).withOptimisticUpdate(
    archivePeriodChange
  );
  const restore = useMutation(tenancy.periods.restore).withOptimisticUpdate(
    restorePeriodChange
  );
  const rename = useMutation(tenancy.periods.rename).withOptimisticUpdate(
    renamePeriodChange
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(period.name);
  const next = name.trim();
  const canSave = next !== period.name && Schema.is(PeriodName)(next);

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
              setName(period.name);
              setIsRenaming(true);
            }}
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("period-rename")}
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
      <ResponsiveDialog
        footer={
          <>
            <Button
              onClick={() => setIsRenaming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                setIsRenaming(false);
                startTransition(() =>
                  saveSchool(
                    () => rename({ name: next, periodId: period.id, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("period-rename-save")}
            </Button>
          </>
        }
        open={isRenaming}
        setOpen={setIsRenaming}
        title={t("period-rename")}
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
        </FieldGroup>
      </ResponsiveDialog>
    </div>
  );
}
