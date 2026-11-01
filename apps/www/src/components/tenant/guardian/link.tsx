import { type PaginatedQueryItem, useMutation } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  PencilEdit02Icon,
  Unlink01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
import { WithAction } from "@/components/tenant/action";
import { useTenant } from "@/components/tenant/context";
import { GuardianLinkAddressDialog } from "@/components/tenant/guardian/address";
import {
  revokeLinkChange,
  verifyLinkChange,
} from "@/components/tenant/guardian/change";
import { PersonRenameDialog } from "@/components/tenant/settings/rename";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/link";

/** The dialogs of a live link, from its row menu or its open pane. */
type LinkDialog = "readdress" | "rename" | "revoke";

/** One guardian link as the staff list shows it. */
export type LinkItem = PaginatedQueryItem<typeof guardians.links.list>;

/**
 * The actions of a live link in its open pane: rename the parent, correct its email and check it by hand while it is pending, and end it.
 */
export function GuardianLinkActions({ link }: { link: LinkItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const verify = useMutation(guardians.links.verify).withOptimisticUpdate(
    verifyLinkChange
  );
  const [, startTransition] = useTransition();
  const dialogs = useDialogs<LinkDialog>();

  return (
    <>
      <Button
        onClick={() => dialogs.show("revoke")}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={Unlink01Icon} />
        {t("link-revoke")}
      </Button>
      <WithAction action="person.manage">
        <Button
          onClick={() => dialogs.show("rename")}
          type="button"
          variant="outline"
        >
          <HugeIcons icon={UserEdit01Icon} />
          {t("link-rename")}
        </Button>
      </WithAction>
      {link.status === "pending" ? (
        <>
          <Button
            onClick={() => dialogs.show("readdress")}
            type="button"
            variant="outline"
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("link-readdress")}
          </Button>
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
        </>
      ) : null}
      <GuardianLinkDialogs dialogs={dialogs} link={link} />
    </>
  );
}

/**
 * A live link's row menu: rename the parent, correct its email and check it by hand while it is pending, and end it behind a
 * confirmation. A link the server has not answered yet keeps its menu inert, and an ended link has no menu, so its
 * cell stays empty. The dialogs stay mounted past a revoke, so the confirmation plays its exit as the row ends.
 */
export function GuardianLinkMenu({ link }: { link: LinkItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const verify = useMutation(guardians.links.verify).withOptimisticUpdate(
    verifyLinkChange
  );
  const [, startTransition] = useTransition();
  const dialogs = useDialogs<LinkDialog>();

  return (
    <div className="flex justify-end">
      {link.status === "pending" || link.status === "verified" ? (
        <RowItems>
          <WithAction action="person.manage">
            <DropdownMenuItem onClick={() => dialogs.show("rename")}>
              <HugeIcons icon={UserEdit01Icon} />
              {t("link-rename")}
            </DropdownMenuItem>
          </WithAction>
          {link.status === "pending" ? (
            <>
              <DropdownMenuItem onClick={() => dialogs.show("readdress")}>
                <HugeIcons icon={PencilEdit02Icon} />
                {t("link-readdress")}
              </DropdownMenuItem>
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
            onClick={() => dialogs.show("revoke")}
            variant="destructive"
          >
            <HugeIcons icon={Unlink01Icon} />
            {t("link-revoke")}
          </DropdownMenuItem>
        </RowItems>
      ) : null}
      <GuardianLinkDialogs dialogs={dialogs} link={link} />
    </div>
  );
}

/**
 * The dialogs of a live link, for its row menu and its open pane alike. Each opening of the email or the name dialog
 * mounts it again, so it starts from the link as it is then.
 */
function GuardianLinkDialogs({
  dialogs,
  link,
}: {
  dialogs: ReturnType<typeof useDialogs<LinkDialog>>;
  link: LinkItem;
}) {
  return (
    <>
      {dialogs.kind === "readdress" ? (
        <GuardianLinkAddressDialog key={dialogs.key} link={link} />
      ) : null}
      {dialogs.kind === "rename" ? (
        <PersonRenameDialog
          key={dialogs.key}
          open={dialogs.isOpen("rename")}
          person={link.guardian}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      <GuardianLinkRevokeDialog
        link={link}
        open={dialogs.isOpen("revoke")}
        setOpen={dialogs.setOpen}
      />
    </>
  );
}

/** The confirmation that ends a live link, from its row menu or its open pane. */
function GuardianLinkRevokeDialog({
  link,
  open,
  setOpen,
}: {
  link: LinkItem;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const { slug } = useTenant();
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
            <HugeIcons icon={Unlink01Icon} />
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
