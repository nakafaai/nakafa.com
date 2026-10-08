"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "next-intl";

/** Links one article catalog page to its release-bound continuation. */
export function ArticleNext({ href }: { readonly href: string }) {
  const t = useTranslations("Common");
  const label = t("next");

  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <NavigationLink
        className={buttonVariants({ variant: "outline" })}
        href={href}
        title={label}
      >
        <span>{label}</span>
        <HugeIcons aria-hidden="true" icon={ArrowRight02Icon} />
      </NavigationLink>
    </nav>
  );
}
