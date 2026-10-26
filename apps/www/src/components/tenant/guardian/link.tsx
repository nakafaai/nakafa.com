import { type PaginatedQueryItem, useMutation } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  MoreHorizontalIcon,
  Unlink01Icon,
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
import { useTenant } from "@/components/tenant/context";
import {
  revokeLinkChange,
  verifyLinkChange,
} from "@/components/tenant/guardian/change";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/link";

/** One guardian link as the staff list shows it. */
export type LinkItem = PaginatedQueryItem<typeof guardians.links.list>;

/** The actions of a live link in its open pane: check by hand while it is pending, and end it. */
export function GuardianLinkActions({ link }: { link: LinkItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
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
      />
    </>
  );
}

/**
 * A live link's row menu: check by hand while it is pending, and end it behind a
 * confirmation. An ended link has no menu, so its cell stays empty.
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
