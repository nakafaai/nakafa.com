"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import {
  EXACT_ACTIVE_OPTIONS,
  HrefLink,
} from "@repo/internationalization/src/link";
import { useTranslations } from "use-intl";

/** Links one article catalog page to its release-bound continuation. */
export function ArticleNext({ href }: { readonly href: string }) {
  const t = useTranslations("Common");
  const label = t("next");

  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <HrefLink
        activeOptions={EXACT_ACTIVE_OPTIONS}
        className={buttonVariants({ variant: "outline" })}
        href={href}
        title={label}
      >
        <span>{label}</span>
        <HugeIcons aria-hidden="true" icon={ArrowRight02Icon} />
      </HrefLink>
    </nav>
  );
}
