import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import {
  TableFilter,
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { roleIcon } from "@/components/tenant/roles";
import { SchoolGrantDialog } from "@/components/tenant/settings/grant";
import { SchoolGrantTable } from "@/components/tenant/settings/roles/grants";
import { scopeOptions } from "@/components/tenant/settings/scope";
import { SettingsTablePage } from "@/components/tenant/settings/section";

/** How many grants one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/**
 * The roles of the school: Role guide in the header opens what each role may do, and
 * Give role opens the dialog that gives a role of the whole school to a person. The
 * grants sit in a data table, and each grant's revoke action sits in its row menu.
 */
export function SchoolRolesSettings() {
  const t = useTranslations("SchoolSettings");
  const [isGuiding, setIsGuiding] = useState(false);
  const [isGiving, setIsGiving] = useState(false);
  const tSchool = useTranslations("School");
  const viewer = useViewerQuery();

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("roles-search")} />
            <TableFilter
              facets={[
                {
                  column: "role",
                  options: Arr.map(BuiltinRole.literals, (role) => ({
                    icon: roleIcon(role),
                    label: tSchool(`role.${role}`),
                    value: role,
                  })),
                  title: t("grant-role"),
                },
                {
                  column: "scope",
                  options: QueryResult.isSuccess(viewer)
                    ? scopeOptions(viewer.value.tenant.name, viewer.value.units)
                    : [],
                  title: t("grant-scope"),
                },
              ]}
            />
            {/* On a phone the guide keeps its icon, so the page's name keeps its room. */}
            <Button
              onClick={() => setIsGuiding(true)}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={BookOpen01Icon} />
              <span className="max-sm:sr-only">{t("roles-guide")}</span>
            </Button>
            <Button onClick={() => setIsGiving(true)} type="button">
              {t("roles-assign")}
            </Button>
          </>
        }
      >
        <ReadBoundary>
          <SchoolGrantsBody />
        </ReadBoundary>
        <SchoolRoleGuide open={isGuiding} setOpen={setIsGuiding} />
        <SchoolGrantDialog open={isGiving} setOpen={setIsGiving} />
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The grants of the school, read a page at a time, with the table and its end. */
function SchoolGrantsBody() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    access.grants.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <SchoolGrantTable grants={pagination.results} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * The sheet that says what each built-in role may do: a header, each role's badge above
 * its description, and a footer with its one sentence and Close, each set off by a line.
 */
function SchoolRoleGuide({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("roles-overview")}</SheetTitle>
          <SheetDescription>{t("roles-overview-description")}</SheetDescription>
        </SheetHeader>
        <ul className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {Arr.map(BuiltinRole.literals, (role) => (
            <li className="flex flex-col items-start gap-1.5" key={role}>
              <RoleBadge role={role} />
              <p className="text-muted-foreground text-sm">
                {t(`role-description.${role}`)}
              </p>
            </li>
          ))}
        </ul>
        <SheetFooter className="flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {t("roles-overview-footer")}
          </p>
          <SheetClose
            render={
              <Button className="shrink-0" type="button" variant="outline">
                {common("close")}
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
