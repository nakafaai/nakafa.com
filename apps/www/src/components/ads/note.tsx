import {
  Diamond02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Link } from "@/lib/routing/link";

/**
 * The frame's question and the founder's answer: a dialog on a wide screen and a
 * drawer on a phone. The note says why lessons and articles carry ads and what
 * Pro changes, signed by the founder; it never asks anyone to look at or press
 * an ad. Its button folds to its icon where the frame's footer is narrow, and
 * keeps its name for assistive technology and in its tooltip. The dialog's footer
 * offers the way out beside Pro.
 */
export function AdNote() {
  const t = useTranslations("Ads");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="@max-sm/ad:has-[>svg]:px-2.5"
              onClick={() => setOpen(true)}
              type="button"
              variant="outline"
            />
          }
        >
          <HugeIcons aria-hidden="true" icon={InformationCircleIcon} />
          <span className="@max-sm/ad:sr-only">{t("why")}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{t("why")}</TooltipContent>
      </Tooltip>
      <ResponsiveDialog
        description={t("note-description")}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {t("later")}
            </Button>
            <Link className={buttonVariants()} to="/$locale/pricing">
              <HugeIcons icon={Diamond02Icon} />
              {t("pro")}
            </Link>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("note-title")}
      >
        <div className="grid gap-3 text-sm leading-6">
          <p className="text-pretty">{t("note-reason")}</p>
          <p className="text-pretty">{t("note-pro")}</p>
          <p className="text-muted-foreground">{t("note-signature")}</p>
        </div>
      </ResponsiveDialog>
    </>
  );
}
