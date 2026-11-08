import { Diamond02Icon } from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { AdNote } from "@/components/ads/note";
import { Link } from "@/lib/routing/link";

/**
 * The frame of one ad in Nakafa's own card: the header names it with the only
 * label the AdSense policy allows in the page's language, the body holds the ad
 * unit and nothing else, and the footer, under a rule and its own band, says
 * that Pro has no ads beside two plain buttons, the founder's note and Pro. No
 * line ties the ad to supporting Nakafa or asks anyone to press it, and the rule
 * and the band keep the buttons apart from the ad.
 */
export function AdFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("Ads");

  return (
    <aside aria-label={t("label")} className="my-8">
      <Card className="gap-0 py-0" size="sm">
        <CardHeader className="border-b pt-(--card-spacing)">
          <CardTitle>{t("label")}</CardTitle>
        </CardHeader>
        <CardContent className="py-(--card-spacing)">{children}</CardContent>
        <CardFooter className="bg-muted/20 min-h-15 flex-wrap justify-end gap-x-4 gap-y-3 border-t py-3">
          <p className="text-muted-foreground me-auto text-sm">{t("footer")}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdNote />
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/$locale/pricing"
            >
              <HugeIcons icon={Diamond02Icon} />
              {t("pro")}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </aside>
  );
}
