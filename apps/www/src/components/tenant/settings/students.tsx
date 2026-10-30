import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { MoreHorizontalIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
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
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  addStudentChange,
  reissueCardChange,
} from "@/components/tenant/settings/accounts";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/** The columns of the logins table. */
const loginColumns = createColumnHelper<typeof dataTableFeatures, LoginItem>();

/** Opens a card the server issued in the page's card dialog. */
const CardIssueContext = createContext<((card: CardView) => void) | null>(null);

/** Reads what opens an issued card. It throws outside the students page, which always provides it. */
function useIssueCard() {
  const issue = use(CardIssueContext);
  if (issue === null) {
    throw new Error("useIssueCard must be used within SchoolStudentsSettings");
  }
  return issue;
}

/**
 * The student accounts of the school: Add student in the header creates a student and
 * the first card in one step. The logins sit in a data table, and each login's reissue
 * action sits in its row menu. A card's code shows once, in the card dialog, which
 * prints the card.
 */
export function SchoolStudentsSettings() {
  const t = useTranslations("SchoolSettings");
  const [isAdding, setIsAdding] = useState(false);
  const [issued, setIssued] = useState<CardView | undefined>(undefined);

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("logins-search")} />
            <Button onClick={() => setIsAdding(true)} type="button">
              {t("student-add")}
            </Button>
          </>
        }
      >
        <ReadBoundary>
          <CardIssueContext value={setIssued}>
            <SchoolLoginsBody />
          </CardIssueContext>
        </ReadBoundary>
        <SchoolStudentDialog
          onAdded={setIssued}
          open={isAdding}
          setOpen={setIsAdding}
        />
        <SchoolCardDialog card={issued} onClose={() => setIssued(undefined)} />
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The school's logins, read a page at a time, with the table and its end. */
function SchoolLoginsBody() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    identity.logins.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <SchoolLoginTable logins={pagination.results} />
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
function SchoolLoginTable({ logins }: { logins: readonly LoginItem[] }) {
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
      meta: { align: "end" },
      sortFn: "basic",
    }),
    loginColumns.display({
      cell: (info) => <SchoolLoginMenu login={info.row.original} />,
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={logins}
      rowId={(login) => login.loginName}
      search="login"
    />
  );
}

/**
 * A login's row menu, which reissues the card of its person. The menu waits while the
 * reissue runs, and the new card opens in the card dialog.
 */
function SchoolLoginMenu({ login }: { login: LoginItem }) {
  const { slug } = useTenant();
  const issueCard = useIssueCard();
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
                  (card) => issueCard({ ...card, name: login.person.name })
                )
              )
            }
          >
            <HugeIcons icon={Refresh01Icon} />
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
}: {
  onAdded: (card: CardView) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { slug } = useTenant();
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
          <p className="me-auto text-muted-foreground text-sm">
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
            placeholder={t("student-add-name-placeholder")}
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
