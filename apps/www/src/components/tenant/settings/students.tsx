import {
  type PaginatedQueryItem,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  AtIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { LoginName } from "@repo/backend/confect/identity/schema";
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
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Option, Schema } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  addStudentChange,
  reissueCardChange,
} from "@/components/tenant/settings/accounts";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import {
  LoginNameField,
  LoginRenameDialog,
} from "@/components/tenant/settings/login";
import { PersonRenameDialog } from "@/components/tenant/settings/rename";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import {
  SchoolDateTime,
  useSchoolTimeZone,
} from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/students";

/** How many login names one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One school login as the logins list shows it. */
type LoginItem = PaginatedQueryItem<typeof identity.logins.list>;

/** The columns of the logins table. */
const loginColumns = tableColumns<LoginItem>();

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
            <SchoolHeaderAdd
              label={t("student-add")}
              onClick={() => setIsAdding(true)}
            />
          </>
        }
      >
        <ReadBoundary>
          <CardIssueContext value={setIssued}>
            <SchoolLoginTable />
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

/**
 * The school's login names, read a page at a time, in a data table that finds a login name and
 * sorts by when each card was issued, or the table's empty state when no card is issued.
 */
function SchoolLoginTable() {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const formatZone = useFormatTimeZone();
  const timeZone = useSchoolTimeZone();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    identity.logins.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const columns = [
    // The login name with the student's name after it, so the header's search finds a login by either; the cell
    // shows the login name.
    loginColumns.text((login) => `${login.loginName} ${login.person.name}`, {
      cell: (info) => (
        <span className="font-medium">{info.row.original.loginName}</span>
      ),
      header: t("login-name"),
      id: "login",
    }),
    loginColumns.text((login) => login.person.name, {
      header: t("login-person"),
      id: "person",
    }),
    loginColumns.days((login) => login.issuedAt, {
      cell: (info) => <SchoolDateTime at={info.getValue()} />,
      header: t("login-issued"),
      id: "issued",
      timeZone: () => Option.getOrElse(timeZone, formatZone),
    }),
    loginColumns.menu((info) => <SchoolLoginMenu login={info.row.original} />),
  ];

  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={pagination.results}
        empty={
          <TableEmpty
            act="pointing"
            description={t("logins-footer")}
            title={t("logins-empty")}
          />
        }
        rowId={(login) => login.person.id}
        search="login"
      />
    </TablePages>
  );
}

/**
 * A login's row menu: Rename, which renames its person, Change login name, which changes the name the person signs in
 * with, and Reissue card, which reissues the person's card. The menu waits while the reissue runs, and the new card
 * opens in the card dialog.
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [renaming, setRenaming] = useState(0);
  const [isChangingLogin, setIsChangingLogin] = useState(false);
  const [changingLogin, setChangingLogin] = useState(0);

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
            onClick={() => {
              setRenaming((count) => count + 1);
              setIsRenaming(true);
            }}
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("person-rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setChangingLogin((count) => count + 1);
              setIsChangingLogin(true);
            }}
          >
            <HugeIcons icon={AtIcon} />
            {t("login-rename")}
          </DropdownMenuItem>
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
      <PersonRenameDialog
        key={renaming}
        open={isRenaming}
        person={login.person}
        setOpen={setIsRenaming}
      />
      <LoginRenameDialog
        key={changingLogin}
        login={login}
        open={isChangingLogin}
        setOpen={setIsChangingLogin}
      />
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
  const parsedLogin = Schema.decodeOption(LoginName)(login);
  const loginProblem = login !== "" && Option.isNone(parsedLogin);
  const submittable = Option.isSome(parsedName) && Option.isSome(parsedLogin);

  return (
    <ResponsiveDialog
      description={t("student-add-description")}
      footer={
        <>
          <p className="text-muted-foreground me-auto text-sm">
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
              if (Option.isNone(parsedName) || Option.isNone(parsedLogin)) {
                return;
              }
              const studentName = parsedName.value;
              setOpen(false);
              startTransition(() =>
                saveSchool(
                  () =>
                    enroll({
                      loginName: parsedLogin.value,
                      name: studentName,
                      slug,
                    }),
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
        <LoginNameField
          onChange={setLoginName}
          problem={loginProblem}
          value={loginName}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}
