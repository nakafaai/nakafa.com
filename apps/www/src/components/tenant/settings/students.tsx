import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  addStudentChange,
  reissueCardChange,
} from "@/components/tenant/settings/accounts";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolDateTime } from "@/components/tenant/settings/time";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
export const PAGE_SIZE = 25;

/** The first page of the list, which its loader read on the server. */
type StudentsFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof identity.logins.list>
>;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/** The columns of the logins table. */
const loginColumns = createColumnHelper<typeof dataTableFeatures, LoginItem>();

/** The first page of the logins, which the page's loader read on the server. */
const StudentsFirstPageContext = createContext<StudentsFirstPage | undefined>(
  undefined
);

/**
 * The student accounts of the school: Add student in the header creates a student and
 * the first card in one step. The logins sit in a data table, and each login's reissue
 * action sits in its row menu. A card's code shows once, in the card dialog, which
 * prints the card.
 */
export function SchoolStudentsSettings({
  first,
  slug,
}: {
  first: StudentsFirstPage | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const [isAdding, setIsAdding] = useState(false);
  const [issued, setIssued] = useState<CardView | undefined>(undefined);

  return (
    <SettingsPage
      actions={
        <Button onClick={() => setIsAdding(true)} type="button">
          {t("student-add")}
        </Button>
      }
    >
      <ReadBoundary>
        <StudentsFirstPageContext value={first}>
          <SchoolLoginsBody onIssued={setIssued} slug={slug} />
        </StudentsFirstPageContext>
      </ReadBoundary>
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

/** The school's logins, read a page at a time, with the table and its end. */
function SchoolLoginsBody({
  onIssued,
  slug,
}: {
  onIssued: (card: CardView) => void;
  slug: TenantSlug;
}) {
  const first = use(StudentsFirstPageContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    identity.logins.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE },
    Option.fromUndefinedOr(first)
  );

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <SchoolLoginTable
          logins={pagination.results}
          onIssued={onIssued}
          slug={slug}
        />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
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
      cell: (info) => <SchoolDateTime at={info.getValue()} />,
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
  const reissue = useMutation(identity.cards.reissue).withOptimisticUpdate(
    reissueCardChange
  );
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
          <FieldDescription>{t("student-login-rule")}</FieldDescription>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
