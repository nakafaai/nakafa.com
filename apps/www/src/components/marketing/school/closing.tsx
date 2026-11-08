import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { ClosingQuestion } from "@/components/marketing/about/closing/question";
import { MarketingSection } from "@/components/marketing/shared/section";
import { Link } from "@/lib/routing/link";

/**
 * The last part of a School page before the footer, as the learner's home ends:
 * a question that types what a school runs on Nakafa, the free trial, the
 * page's other action when it has one, given as children, and Nina ringing the
 * school bell.
 */
export function SchoolClosing({ children }: { children?: ReactNode }) {
  const t = useTranslations("SchoolSite");
  const topics: Arr.NonEmptyReadonlyArray<string> = [
    t("closing-topic-0"),
    t("closing-topic-1"),
    t("closing-topic-2"),
    t("closing-topic-3"),
    t("closing-topic-4"),
  ];

  return (
    <MarketingSection id="closing">
      <div className="mx-auto grid w-full max-w-4xl justify-items-center gap-10 text-center">
        <ClosingQuestion template={t.raw("closing-ask")} topics={topics} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            className={buttonVariants({ size: "lg", variant: "secondary" })}
            to="/$locale/school/new"
          >
            {t("hero-start")}
          </Link>
          {children}
        </div>
        <Nina act="ringing" label="" size={240} whole />
      </div>
    </MarketingSection>
  );
}
