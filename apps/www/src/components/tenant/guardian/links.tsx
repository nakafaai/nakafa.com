import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
} from "@confect/react";
import {
  CheckmarkBadge01Icon,
  Clock01Icon,
  Link01Icon,
  MoreHorizontalIcon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { LinkStatus } from "@repo/backend/confect/guardians/schema";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Array as Arr, Option, Schema, String as Str } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
  PaneOpen,
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFilter,
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import {
  revokeLinkChange,
  startLinkChange,
  verifyLinkChange,
} from "@/components/tenant/guardian/change";
import { LINK_STATUS_ICONS } from "@/components/tenant/guardian/status";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  type PersonId,
  SchoolStudentPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { SchoolDateTime } from "@/components/tenant/settings/time";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";

const SOURCE = "components/tenant/guardian/links";

/** How many links one page of the list loads, and each page after it. */
export const PAGE_SIZE = 25;

/** One guardian link as the list shows it. */
type LinkItem = PaginatedQueryItem<typeof guardians.links.list>;

/** The first page of the list, which its loader read on the server. */
type LinksFirstPage = PreloadedPage<LinkItem>;

/** The columns of the links table. */
const linkColumns = createColumnHelper<typeof dataTableFeatures, LinkItem>();

/** The first page of the links, which the page's loader read on the server. */
const LinksFirstPageContext = createContext<LinksFirstPage | undefined>(
  undefined
);

/**
 * The guardian links of the school (ADR 0034). The header holds the search by student, the
 * status filter and Link a parent. The body is the links table, and the link a press opens
 * stands beside it on a wide screen and in a sheet on a phone: the parent, the address, the
 * state, and its actions. A link that the roster cannot check by NISN is checked by hand, and
 * any live link can be ended, from its row menu or from the open link.
 */
export function GuardianLinksSettings({
  first,
  slug,
}: {
  first: LinksFirstPage | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const [isStarting, setIsStarting] = useState(false);

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <SettingsTablePage
          actions={
            <>
              <TableSearch placeholder={t("links-search")} />
              <TableFilter
                facets={[
                  {
                    column: "status",
                    icon: Clock01Icon,
                    options: Arr.map(LinkStatus.literals, (status) => ({
                      icon: LINK_STATUS_ICONS[status],
                      label: t(`status-${status}`),
                      value: status,
                    })),
                    title: t("status"),
                  },
                ]}
              />
              <Button onClick={() => setIsStarting(true)} type="button">
                <HugeIcons icon={Link01Icon} />
                {t("link-add")}
              </Button>
            </>
          }
        >
          <ReadBoundary>
            <LinksFirstPageContext value={first}>
              <GuardianLinksBody slug={slug} />
            </LinksFirstPageContext>
          </ReadBoundary>
          <GuardianLinkStartDialog
            open={isStarting}
            setOpen={setIsStarting}
            slug={slug}
          />
        </SettingsTablePage>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The links of the school, read a page at a time: the table, which loads more rows as its end
 * comes into view, beside the open link; or the empty state while the school has no link.
 */
function GuardianLinksBody({ slug }: { slug: TenantSlug }) {
  const first = use(LinksFirstPageContext);
  const t = useTranslations("SchoolGuardians");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    guardians.links.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE },
    Option.fromUndefinedOr(first)
  );

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <DataFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="typing"
        description={t("links-empty-description")}
        title={t("links-empty")}
      />
    );
  }

  return (
    <Panes>
      <PanesList>
        {failed ? <DataFailure onRetry={reloadPage} /> : null}
        <GuardianLinkTable links={pagination.results} slug={slug} />
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </PanesList>
      <PanesDetail empty={t("link-detail-empty")} label={t("link-detail")}>
        <GuardianLinkDetail links={pagination.results} slug={slug} />
      </PanesDetail>
    </Panes>
  );
}

/** The state of a link as staff read it: a pending link whose NISN checks failed says so. */
function useStatusText() {
  const t = useTranslations("SchoolGuardians");

  return (link: LinkItem) =>
    link.status === "pending" && link.mismatches > 0
      ? t("status-mismatch")
      : t(`status-${link.status}`);
}

/** The links in a data table: the student, the parent's address, the state, and the row menu. */
function GuardianLinkTable({
  links,
  slug,
}: {
  links: readonly LinkItem[];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const statusText = useStatusText();

  const columns = linkColumns.columns([
    linkColumns.accessor((link) => link.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.id}>{info.getValue()}</PaneOpen>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.email, {
      header: t("email-label"),
      id: "email",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.status, {
      cell: (info) => (
        <span className="flex items-center gap-2">
          <HugeIcons icon={LINK_STATUS_ICONS[info.getValue()]} />
          {statusText(info.row.original)}
        </span>
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("status"),
      id: "status",
    }),
    linkColumns.display({
      cell: (info) => <GuardianLinkMenu link={info.row.original} slug={slug} />,
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={links}
      rowId={(link) => link.id}
      search="student"
    />
  );
}

/**
 * The open link: the student, the parent's name and address, the state, when a pending link
 * expires, and how many NISN checks failed; then the link's actions in the footer. A link the
 * list no longer holds closes.
 */
function GuardianLinkDetail({
  links,
  slug,
}: {
  links: readonly LinkItem[];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const statusText = useStatusText();
  const open = usePanes((state) => state.open);
  const link = Option.flatMap(open, (id) =>
    Arr.findFirst(links, (candidate) => candidate.id === id)
  );

  return Option.match(link, {
    onNone: () => null,
    onSome: (found) => (
      <>
        <PaneHeader
          description={found.guardian.name}
          title={found.student.name}
        />
        <PaneBody>
          <PaneFacts>
            <PaneFact label={t("guardian-name")}>
              {found.guardian.name}
            </PaneFact>
            <PaneFact label={t("email-label")}>
              <span className="break-all">{found.email}</span>
            </PaneFact>
            <PaneFact label={t("status")}>
              <span className="flex items-center gap-2">
                <HugeIcons icon={LINK_STATUS_ICONS[found.status]} />
                {statusText(found)}
              </span>
            </PaneFact>
            {found.status === "pending" ? (
              <PaneFact label={t("expires")}>
                <SchoolDateTime at={found.expiresAt} />
              </PaneFact>
            ) : null}
            {found.mismatches > 0 ? (
              <PaneFact label={t("mismatches")}>{found.mismatches}</PaneFact>
            ) : null}
          </PaneFacts>
        </PaneBody>
        {found.status === "pending" || found.status === "verified" ? (
          <PaneFooter>
            <GuardianLinkActions link={found} slug={slug} />
          </PaneFooter>
        ) : null}
      </>
    ),
  });
}

/** The actions of a live link in its open pane: check by hand while it is pending, and end it. */
function GuardianLinkActions({
  link,
  slug,
}: {
  link: LinkItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const verify = useMutation(guardians.links.verify).withOptimisticUpdate(
    verifyLinkChange
  );
  const [, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsRevoking(true)}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={Unlink01Icon} />
        {t("link-revoke")}
      </Button>
      {link.status === "pending" ? (
        <Button
          onClick={() =>
            startTransition(() =>
              saveSchool(() => verify({ linkId: link.id, slug }), SOURCE)
            )
          }
          type="button"
        >
          <HugeIcons icon={CheckmarkBadge01Icon} />
          {t("link-verify")}
        </Button>
      ) : null}
      <GuardianLinkRevokeDialog
        link={link}
        open={isRevoking}
        setOpen={setIsRevoking}
        slug={slug}
      />
    </>
  );
}

/**
 * A live link's row menu: check by hand while it is pending, and end it behind a
 * confirmation. An ended link has no menu, so its cell stays empty.
 */
function GuardianLinkMenu({
  link,
  slug,
}: {
  link: LinkItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const verify = useMutation(guardians.links.verify).withOptimisticUpdate(
    verifyLinkChange
  );
  const [, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);

  if (link.status !== "pending" && link.status !== "verified") {
    return null;
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          {link.status === "pending" ? (
            <>
              <DropdownMenuItem
                onClick={() =>
                  startTransition(() =>
                    saveSchool(() => verify({ linkId: link.id, slug }), SOURCE)
                  )
                }
              >
                <HugeIcons icon={CheckmarkBadge01Icon} />
                {t("link-verify")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            onClick={() => setIsRevoking(true)}
            variant="destructive"
          >
            <HugeIcons icon={Unlink01Icon} />
            {t("link-revoke")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <GuardianLinkRevokeDialog
        link={link}
        open={isRevoking}
        setOpen={setIsRevoking}
        slug={slug}
      />
    </div>
  );
}

/** The confirmation that ends a live link, from its row menu or its open pane. */
function GuardianLinkRevokeDialog({
  link,
  open,
  setOpen,
  slug,
}: {
  link: LinkItem;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const revoke = useMutation(guardians.links.revoke).withOptimisticUpdate(
    revokeLinkChange
  );
  const [, startTransition] = useTransition();

  return (
    <ResponsiveDialog
      description={t("link-revoke-description")}
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
            onClick={() => {
              setOpen(false);
              startTransition(() =>
                saveSchool(() => revoke({ linkId: link.id, slug }), SOURCE)
              );
            }}
            type="button"
            variant="destructive"
          >
            {t("link-revoke")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("link-revoke-title")}
    />
  );
}

/**
 * The dialog that links a guardian to a student: the student, the guardian's name, and the
 * address that will receive the sign-in code. Nothing is mailed now: the guardian asks for a
 * code on the school's parent page. The dialog closes as the link is sent.
 */
function GuardianLinkStartDialog({
  open,
  setOpen,
  slug,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const id = useId();
  const start = useMutation(guardians.links.start).withOptimisticUpdate(
    startLinkChange
  );
  const [isPending, startTransition] = useTransition();
  const [studentId, setStudentId] = useState<PersonId | undefined>(undefined);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const guardianName = Schema.decodeOption(PersonName)(Str.trim(name));
  const address = Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(email)));
  const ready =
    studentId !== undefined &&
    Option.isSome(guardianName) &&
    Option.isSome(address);

  const submit = () => {
    if (
      studentId === undefined ||
      Option.isNone(guardianName) ||
      Option.isNone(address)
    ) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          start({
            email: address.value,
            guardianName: guardianName.value,
            slug,
            studentId,
          }),
        SOURCE,
        () => {
          setStudentId(undefined);
          setName("");
          setEmail("");
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("link-add-description")}
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
            disabled={!ready || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("link-add")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("link-add")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-student`}>{t("student")}</FieldLabel>
          <SchoolStudentPicker
            id={`${id}-student`}
            onChoose={setStudentId}
            personId={studentId}
            slug={slug}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("guardian-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-email`}>{t("email-label")}</FieldLabel>
          <Input
            autoComplete="off"
            id={`${id}-email`}
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
