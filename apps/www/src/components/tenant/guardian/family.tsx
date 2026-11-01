import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Link01Icon } from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option, Schema, String as Str } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import {
  type FamilyItem,
  inviteParentChange,
} from "@/components/tenant/guardian/change";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { SchoolHeader } from "@/components/tenant/header";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/family";

/**
 * A student's parents: the links the student and the school started, each with its state,
 * and Invite a parent in the header. The link waits for the parent's sign-in code and the
 * NISN check, as any link does (ADR 0034).
 */
export function StudentFamily() {
  const t = useTranslations("SchoolGuardians");
  const [isInviting, setIsInviting] = useState(false);

  return (
    <>
      <SchoolHeader items={[{ label: t("family-title") }]}>
        <Button onClick={() => setIsInviting(true)} type="button">
          {t("family-invite")}
        </Button>
      </SchoolHeader>
      <TablePageBody>
        <FamilyList />
      </TablePageBody>
      <ParentInviteDialog open={isInviting} setOpen={setIsInviting} />
    </>
  );
}

/** The student's links, or the empty state, once the first read has answered. */
function FamilyList() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolGuardians");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const links = useQuery(guardians.links.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(links)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (!QueryResult.isSuccess(links)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(links.value)) {
    return (
      <TableEmpty
        act="typing"
        description={t("family-empty-description")}
        title={t("links-empty")}
      />
    );
  }
  return (
    <ul className="divide-border flex flex-col divide-y">
      {Arr.map(links.value, (link) => (
        <FamilyRow key={link.id} link={link} />
      ))}
    </ul>
  );
}

/** One parent: the name and the address, then the state of the link. */
function FamilyRow({ link }: { link: FamilyItem }) {
  const t = useTranslations("SchoolGuardians");
  const look = LINK_STATUS_LOOKS[link.status];

  return (
    <li className="flex items-center justify-between gap-4 p-4 text-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium" dir="auto">
          {link.guardianName}
        </span>
        <span className="text-muted-foreground truncate">{link.email}</span>
      </div>
      <TableStatus
        icon={look.icon}
        label={t(`status-${link.status}`)}
        tone={look.tone}
      />
    </li>
  );
}

/**
 * The dialog that invites a parent: the parent's name and the address that will receive the
 * sign-in code. Nothing is mailed now: the parent asks for a code on the school's parent page.
 * The dialog closes as the link shows on the page.
 */
function ParentInviteDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const viewer = useViewerQuery();
  const id = useId();
  const start = useMutation(guardians.links.start).withOptimisticUpdate(
    inviteParentChange
  );
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const guardianName = Schema.decodeOption(PersonName)(Str.trim(name));
  const address = Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(email)));
  const ready =
    QueryResult.isSuccess(viewer) &&
    Option.isSome(guardianName) &&
    Option.isSome(address);

  const submit = () => {
    if (
      !QueryResult.isSuccess(viewer) ||
      Option.isNone(guardianName) ||
      Option.isNone(address)
    ) {
      return;
    }
    const studentId = viewer.value.person.id;
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
            <HugeIcons icon={Link01Icon} />
            {t("family-invite")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("family-invite")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("guardian-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("guardian-name-placeholder")}
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
            placeholder={t("email-placeholder")}
            type="email"
            value={email}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
