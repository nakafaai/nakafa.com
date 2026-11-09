import { Diamond02Icon } from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { AdNote } from "@/components/ads/note";
import { Link } from "@/lib/routing/link";

/**
 * The frame of one ad in Nakafa's own card: the header names it with the only
 * label the AdSense policy allows in the page's language, the body holds the ad
 * unit and nothing else, and the footer, under a rule and its own band, says
 * that Pro has no ads beside two plain buttons, the founder's note and Pro. The
 * footer is one row at every width: where it is narrow, as on a phone, the
 * buttons keep their icons and give their names to assistive technology and to
 * their tooltips. No line ties the ad to supporting Nakafa or asks anyone to
 * press it, and the rule and the band keep the buttons apart from the ad. The
 * frame fills the room its place holds, and the unit takes what the header and
 * the footer leave.
 */
export function AdFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("Ads");

  return (
    <aside aria-label={t("label")} className="h-full">
      <Card className="h-full gap-0 py-0" size="sm">
        <CardHeader className="border-b pt-(--card-spacing)">
          <CardTitle>{t("label")}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 py-(--card-spacing)">
          {children}
        </CardContent>
        <CardFooter className="bg-muted/20 @container/ad min-h-15 gap-4 border-t py-3">
          <p className="text-muted-foreground min-w-0 flex-1 text-sm">
            {t("footer")}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <AdNote />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    className={buttonVariants({
                      className: "@max-sm/ad:has-[>svg]:px-2.5",
                      variant: "outline",
                    })}
                    to="/$locale/pricing"
                  />
                }
              >
                <HugeIcons aria-hidden="true" icon={Diamond02Icon} />
                <span className="@max-sm/ad:sr-only">{t("pro")}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{t("pro")}</TooltipContent>
            </Tooltip>
          </div>
        </CardFooter>
      </Card>
    </aside>
  );
}
