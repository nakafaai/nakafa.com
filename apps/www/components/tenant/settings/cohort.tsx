"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
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
import { LayoutContent } from "@/components/shared/content/layout";
import { SchoolHeader } from "@/components/tenant/header";
import {
  archiveCohortChange,
  renameCohortChange,
} from "@/components/tenant/settings/cohorts.client";
import { SchoolHomeroomCard } from "@/components/tenant/settings/homeroom";
import { SchoolCohortMembers } from "@/components/tenant/settings/members";
import { SchoolPlacementAdd } from "@/components/tenant/settings/placement";
import { saveSchool } from "@/components/tenant/settings/save.client";
import {
  type Cohort,
  type CohortDetail,
  isDraft,
} from "@/components/tenant/settings/state";
import { getSchoolSettingsSection } from "@/lib/settings/school";

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

/**
 * One cohort's page: its path and name in the school's one header, with the page's action
 * that places a student at its end, then the homeroom teacher and the students of the cohort.
 * An archived cohort keeps what it holds to read, and offers no action that changes it.
 */
export function SchoolCohortSettings({
  cohortId,
  slug,
}: {
  cohortId: CohortDetail["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const cohort = useQuery(tenancy.cohorts.get, { cohortId, slug });
  if (QueryResult.isFailure(cohort)) {
    throw cohort.error;
  }
  if (!QueryResult.isSuccess(cohort)) {
    return null;
  }
  const detail = cohort.value;
  const isArchived = detail.status === "archived";
  const section = getSchoolSettingsSection("/settings/cohorts");

  return (
    <>
      <SchoolHeader
        items={[
          { href: section.group.href, label: t(section.group.key) },
          { href: section.href, label: t(section.labelKey) },
          { label: detail.name },
        ]}
        title={detail.name}
      >
        {isArchived ? null : (
          <SchoolPlacementAdd cohortId={cohortId} slug={slug} />
        )}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <SchoolHomeroomCard cohort={detail} slug={slug} />
        <SchoolCohortMembers
          cohortId={cohortId}
          isArchived={isArchived}
          periodId={detail.periodId}
          slug={slug}
        />
      </LayoutContent>
    </>
  );
}
