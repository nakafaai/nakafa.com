"use client";

import type { Ref } from "@confect/core";
import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import identity from "@repo/backend/confect/_generated/refs/identity";
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  DataTable,
  type dataTableFeatures,
} from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { SettingsPage } from "@/components/tenant/settings/page";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** A login card as the server issues it: the code the student types once. */
type IssuedCard = Ref.Returns<typeof identity.cards.issue>;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/** The columns of the logins table. */
const loginColumns = createColumnHelper<typeof dataTableFeatures, LoginItem>();

/**
 * The student accounts of the school: Issue card in the header opens the form that
 * issues a card to a person with a login name. The logins sit in a data table, and each
 * login's reissue action sits in its row menu. A card's code shows once, in a dialog.
 */
export function SchoolStudentsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    identity.logins.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const [isIssuing, setIsIssuing] = useState(false);
  const [issued, setIssued] = useState<IssuedCard | undefined>(undefined);

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <SettingsPage
      actions={
        <Button onClick={() => setIsIssuing(true)} type="button">
          {t("card-issue")}
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
      <SchoolCardIssueDialog
        onIssued={setIssued}
        open={isIssuing}
        setOpen={setIsIssuing}
        slug={slug}
      />
      <SchoolSecretDialog
        description={t("card-code-description")}
        onClose={() => setIssued(undefined)}
        secret={issued?.code}
        title={t("card-code-title")}
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
  onIssued: (card: IssuedCard) => void;
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
 * reissue runs, and the new code shows in the section's secret dialog.
 */
function SchoolLoginMenu({
  login,
  onIssued,
  slug,
}: {
  login: LoginItem;
  onIssued: (card: IssuedCard) => void;
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
                  onIssued
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
 * The dialog that issues the first login card of a person, with the login name the
 * person signs in with. The request goes out first and the dialog closes at once; the
 * new code then shows once in the section's secret dialog.
 */
function SchoolCardIssueDialog({
  onIssued,
  open,
  setOpen,
  slug,
}: {
  onIssued: (card: IssuedCard) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const issue = useMutation(identity.cards.issue);
  const [isPending, startTransition] = useTransition();
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);
  const [loginName, setLoginName] = useState("");
  const name = loginName.trim();

  return (
    <ResponsiveDialog
      description={t("card-issue-description")}
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
            disabled={personId === undefined || name === ""}
            inert={isPending}
            onClick={() => {
              if (personId === undefined || name === "") {
                return;
              }
              startTransition(() =>
                saveSchool(
                  () => issue({ loginName: name, personId, slug }),
                  SOURCE,
                  onIssued
                )
              );
              setOpen(false);
            }}
            type="button"
          >
            {t("card-issue")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("card-issue-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-person`}>{t("login-person")}</FieldLabel>
          <SchoolPersonPicker
            id={`${id}-person`}
            onChoose={setPersonId}
            personId={personId}
            slug={slug}
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
          <FieldDescription>{t("card-issue-footer")}</FieldDescription>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
