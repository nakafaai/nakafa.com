import { Mail01Icon, UserQuestion02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import type { ReactNode } from "react";

export interface MarketingFaqItem {
  answer: string;
  question: string;
}

interface FaqSectionProps {
  badge: string;
  children: ReactNode;
  className?: string;
  contactLabel: string;
  description?: string;
  headline: ReactNode;
}

/** Owns the shared marketing FAQ frame while callers compose the question list. */
export function FaqSection({
  badge,
  children,
  className,
  contactLabel,
  description,
  headline,
}: FaqSectionProps) {
  return (
    <div className="mx-auto w-full max-w-7xl border-x">
      <div className={cn("scroll-mt-28 px-6 lg:px-10", className)} id="faq">
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
                <HugeIcons className="size-4" icon={UserQuestion02Icon} />
                {badge}
              </span>
            </div>

            <h2 className="max-w-sm text-balance text-3xl tracking-tight sm:text-4xl">
              {headline}
            </h2>

            {description ? (
              <p className="max-w-sm text-pretty text-lg text-muted-foreground">
                {description}
              </p>
            ) : null}

            <Button
              className="w-fit"
              nativeButton={false}
              render={
                <a
                  href={`mailto:${COMPANY_IDENTITY.email}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={Mail01Icon} />
                  {contactLabel}
                </a>
              }
            />
          </div>

          <div className="lg:col-span-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
