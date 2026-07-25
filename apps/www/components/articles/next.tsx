"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";

/** Links one article catalog page to its release-bound continuation. */
export function ArticleNext({ href }: { readonly href: string }) {
  const t = useTranslations("Common");
  const label = t("next");

  return (
    <nav aria-label={label} className="mt-10 flex justify-center">
      <Button
        nativeButton={false}
        render={
          <NavigationLink href={href} title={label}>
            <span>{label}</span>
            <HugeIcons aria-hidden="true" icon={ArrowRight02Icon} />
          </NavigationLink>
        }
        variant="outline"
      />
    </nav>
  );
}
