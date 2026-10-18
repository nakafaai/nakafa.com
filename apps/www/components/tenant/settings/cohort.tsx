"use client";

import { useMutation } from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
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
import { Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import {
  archiveCohortChange,
  renameCohortChange,
} from "@/components/tenant/settings/cohorts.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { type Cohort, isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/cohort";

/**
 * A cohort's row menu: it renames the cohort in a dialog that saves only a name the cohort
 * does not have yet, or archives it. An archived cohort has no menu, because the server
 * refuses every write to it, so its cell stays empty.
 */
export function SchoolCohortMenu({
  cohort,
  slug,
}: {
  cohort: Cohort;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const archive = useMutation(tenancy.cohorts.archive).withOptimisticUpdate(
    archiveCohortChange
  );
  const rename = useMutation(tenancy.cohorts.rename).withOptimisticUpdate(
    renameCohortChange
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(cohort.name);
  const next = name.trim();
  const canSave = next !== cohort.name && Schema.is(CohortName)(next);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(cohort.id)}
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
              setName(cohort.name);
              setIsRenaming(true);
            }}
          >
            {t("cohort-rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(() => archive({ cohortId: cohort.id, slug }), SOURCE)
              )
            }
          >
            {t("cohort-archive")}
          </DropdownMenuItem>
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
                    () => rename({ cohortId: cohort.id, name: next, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("cohort-rename-save")}
            </Button>
          </>
        }
        open={isRenaming}
        setOpen={setIsRenaming}
        title={t("cohort-rename")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("cohort-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </div>
  );
}
