"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { TargetLink } from "@/lib/routing/link";
import { articleNextTarget } from "@/lib/routing/public/article";

/** Links one article catalog page to its release-bound continuation. */
export function ArticleNext({
  category,
  search,
}: {
  /** The category whose next page this is; the article index has none. */
  readonly category?: string | undefined;
  readonly search: {
    readonly cursor: string;
    readonly manifest: string;
    readonly release: string;
  };
}) {
  const t = useTranslations("Common");
  const label = t("next");
  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <TargetLink
        className={buttonVariants({ variant: "outline" })}
        target={articleNextTarget({ category, search })}
        title={label}
      >
        <span>{label}</span>
        <HugeIcons aria-hidden="true" icon={ArrowRight02Icon} />
      </TargetLink>
    </nav>
  );
}
