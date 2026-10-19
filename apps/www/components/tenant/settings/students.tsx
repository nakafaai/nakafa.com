"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { addStudentChange } from "@/components/tenant/settings/members.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/** The columns of the logins table. */
const loginColumns = createColumnHelper<typeof dataTableFeatures, LoginItem>();

/**
 * The student accounts of the school: Add student in the header creates a student and
 * the first card in one step. The logins sit in a data table, and each login's reissue
 * action sits in its row menu. A card's code shows once, in the card dialog, which
 * prints the card.
 */
export function SchoolStudentsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    identity.logins.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const [isAdding, setIsAdding] = useState(false);
  const [issued, setIssued] = useState<CardView | undefined>(undefined);

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <SettingsPage
      actions={
        <Button onClick={() => setIsAdding(true)} type="button">
          {t("student-add")}
        </Button>
      }
    >
      {pagination._tag === "LoadingFirstPage" ? null : (
        <SchoolLoginTable
          logins={pagination.results}
          onIssued={setIssued}
          slug={slug}
        />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
      <SchoolStudentDialog
        onAdded={setIssued}
        open={isAdding}
        setOpen={setIsAdding}
        slug={slug}
      />
      <SchoolCardDialog
        card={issued}
        onClose={() => setIssued(undefined)}
        slug={slug}
      />
    </SettingsPage>
  );
}

/**
 * The login names in a data table that finds a login name and sorts by when each card was
 * issued, or the table's empty state when no card is issued.
 */
function SchoolLoginTable({
  logins,
  onIssued,
  slug,
}: {
  logins: readonly LoginItem[];
  onIssued: (card: CardView) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");

  if (Arr.isReadonlyArrayEmpty(logins)) {
    return (
      <TableEmpty
        act="pointing"
        description={t("logins-footer")}
        title={t("logins-empty")}
      />
    );
  }

  const columns = loginColumns.columns([
    loginColumns.accessor((login) => login.loginName, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("login-name"),
      id: "login",
      sortFn: "text",
    }),
    loginColumns.accessor((login) => login.person.name, {
      filterFn: "includesString",
      header: t("login-person"),
      id: "person",
      sortFn: "text",
    }),
    loginColumns.accessor((login) => login.issuedAt, {
      cell: (info) => <SchoolDateTime at={info.getValue()} slug={slug} />,
      header: t("login-issued"),
      id: "issued",
      sortFn: "basic",
    }),
    loginColumns.display({
      cell: (info) => (
        <SchoolLoginMenu
          login={info.row.original}
          onIssued={onIssued}
          slug={slug}
        />
      ),
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={logins}
      rowId={(login) => login.loginName}
      search={{ column: "login", placeholder: t("logins-search") }}
    />
  );
}

/**
 * A login's row menu, which reissues the card of its person. The menu waits while the
 * reissue runs, and the new card opens in the card dialog.
 */
function SchoolLoginMenu({
  login,
  onIssued,
  slug,
}: {
  login: LoginItem;
  onIssued: (card: CardView) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const reissue = useMutation(identity.cards.reissue);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isPending}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () => reissue({ personId: login.person.id, slug }),
                  SOURCE,
                  (card) => onIssued({ ...card, name: login.person.name })
                )
              )
            }
          >
            {t("card-reissue")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The dialog that adds a student: the name and the login name. The student and the
 * first card are written together, and the dialog closes at once; the new card then
 * opens in the card dialog. The login name is lowercase, as the school stores it.
 */
function SchoolStudentDialog({
  onAdded,
  open,
  setOpen,
  slug,
}: {
  onAdded: (card: CardView) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const enroll = useMutation(identity.cards.enroll).withOptimisticUpdate(
    addStudentChange
  );
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [loginName, setLoginName] = useState("");
  const parsedName = Schema.decodeOption(PersonName)(name.trim());
  const login = loginName.trim().toLowerCase();
  const submittable = Option.isSome(parsedName) && login !== "";

  return (
    <ResponsiveDialog
      description={t("student-add-description")}
      footer={
        <>
          <p className="mr-auto text-muted-foreground text-sm">
            {t("student-add-footer")}
          </p>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={!submittable}
            inert={isPending}
            onClick={() => {
              if (Option.isNone(parsedName) || login === "") {
                return;
              }
              const studentName = parsedName.value;
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () => enroll({ loginName: login, name: studentName, slug }),
                  SOURCE,
                  (card) => onAdded({ ...card, name: studentName })
                )
              );
            }}
            type="button"
          >
            {t("student-add-submit")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("student-add-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>
            {t("student-add-name")}
          </FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-login`}>
            {t("card-login-name")}
          </FieldLabel>
          <Input
            id={`${id}-login`}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder={t("card-login-name-placeholder")}
            value={loginName}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
