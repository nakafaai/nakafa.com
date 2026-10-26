import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
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
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  revokeLinkChange,
  startLinkChange,
  verifyLinkChange,
} from "@/components/tenant/guardian/change";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  type PersonId,
  SchoolStudentPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
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
 * The guardian links of the school (ADR 0034): each student with the guardian's address
 * and the link's state, in a data table with Link guardian in the header. A link that the
 * roster cannot check by NISN is checked by hand here, and any live link can be ended.
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
    <SettingsPage
      actions={
        <Button onClick={() => setIsStarting(true)} type="button">
          {t("link-add")}
        </Button>
      }
    >
      <ReadBoundary>
        <LinksFirstPageContext value={first}>
          <GuardianLinkTable slug={slug} />
        </LinksFirstPageContext>
      </ReadBoundary>
      <GuardianLinkStartDialog
        open={isStarting}
        setOpen={setIsStarting}
        slug={slug}
      />
    </SettingsPage>
  );
}

/**
 * The links of the school in a data table that filters by student and status and loads more
 * rows as its end comes into view, or the empty state while the school has no link.
 */
function GuardianLinkTable({ slug }: { slug: TenantSlug }) {
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

  const columns = linkColumns.columns([
    linkColumns.accessor((link) => link.student.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.email, {
      cell: (info) => <span className="break-all">{info.getValue()}</span>,
      header: t("email-label"),
      id: "email",
      sortFn: "text",
    }),
    linkColumns.accessor((link) => link.status, {
      cell: (info) =>
        info.row.original.status === "pending" &&
        info.row.original.mismatches > 0
          ? t("status-mismatch")
          : t(`status-${info.getValue()}`),
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
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        facets={[
          {
            column: "status",
            options: Arr.map(LinkStatus.literals, (status) => ({
              label: t(`status-${status}`),
              value: status,
            })),
            title: t("status"),
          },
        ]}
        rowId={(link) => link.id}
        search={{ column: "student", placeholder: t("links-search") }}
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
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
  const revoke = useMutation(guardians.links.revoke).withOptimisticUpdate(
    revokeLinkChange
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
                {t("link-verify")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            onClick={() => setIsRevoking(true)}
            variant="destructive"
          >
            {t("link-revoke")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("link-revoke-description")}
        footer={
          <>
            <Button
              onClick={() => setIsRevoking(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setIsRevoking(false);
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
        open={isRevoking}
        setOpen={setIsRevoking}
        title={t("link-revoke-title")}
      />
    </div>
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
