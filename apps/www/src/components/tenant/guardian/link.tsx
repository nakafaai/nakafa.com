import { type PaginatedQueryItem, useMutation } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Unlink01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { WithAction } from "@/components/tenant/action";
import { useTenant } from "@/components/tenant/context";
import { GuardianLinkAddressDialog } from "@/components/tenant/guardian/address";
import {
  revokeLinkChange,
  verifyLinkChange,
} from "@/components/tenant/guardian/change";
import { PersonRenameDialog } from "@/components/tenant/settings/rename";
import { saveSchool } from "@/components/tenant/settings/save";
import { isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/guardian/link";

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
  const [isRevoking, setIsRevoking] = useState(false);
  // Each opening of the email dialog mounts it again, so it starts from the link as it is then.
  const [readdressing, setReaddressing] = useState(0);
  // Each opening of the name dialog mounts it again, so it starts from the name as it is then.
  const [renaming, setRenaming] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);

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
      <WithAction action="person.manage">
        <Button
          onClick={() => {
            setRenaming((count) => count + 1);
            setIsRenaming(true);
          }}
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
            onClick={() => setReaddressing((count) => count + 1)}
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
      {readdressing === 0 ? null : (
        <GuardianLinkAddressDialog key={readdressing} link={link} />
      )}
      {renaming === 0 ? null : (
        <PersonRenameDialog
          key={renaming}
          open={isRenaming}
          person={link.guardian}
          setOpen={setIsRenaming}
        />
      )}
      <GuardianLinkRevokeDialog
        link={link}
        open={isRevoking}
        setOpen={setIsRevoking}
      />
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
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const verify = useMutation(guardians.links.verify).withOptimisticUpdate(
    verifyLinkChange
  );
  const [, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);
  // Each opening of the email dialog mounts it again, so it starts from the link as it is then.
  const [readdressing, setReaddressing] = useState(0);
  // Each opening of the name dialog mounts it again, so it starts from the name as it is then.
  const [renaming, setRenaming] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <div className="flex justify-end">
      {link.status === "pending" || link.status === "verified" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                inert={isDraft(link.id)}
                size="icon-sm"
                variant="ghost"
              >
                <HugeIcons icon={MoreHorizontalIcon} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <WithAction action="person.manage">
              <DropdownMenuItem
                onClick={() => {
                  setRenaming((count) => count + 1);
                  setIsRenaming(true);
                }}
              >
                <HugeIcons icon={UserEdit01Icon} />
                {t("link-rename")}
              </DropdownMenuItem>
            </WithAction>
            {link.status === "pending" ? (
              <>
                <DropdownMenuItem
                  onClick={() => setReaddressing((count) => count + 1)}
                >
                  <HugeIcons icon={PencilEdit02Icon} />
                  {t("link-readdress")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    startTransition(() =>
                      saveSchool(
                        () => verify({ linkId: link.id, slug }),
                        SOURCE
                      )
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
      ) : null}
      {readdressing === 0 ? null : (
        <GuardianLinkAddressDialog key={readdressing} link={link} />
      )}
      {renaming === 0 ? null : (
        <PersonRenameDialog
          key={renaming}
          open={isRenaming}
          person={link.guardian}
          setOpen={setIsRenaming}
        />
      )}
      <GuardianLinkRevokeDialog
        link={link}
        open={isRevoking}
        setOpen={setIsRevoking}
      />
    </div>
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
