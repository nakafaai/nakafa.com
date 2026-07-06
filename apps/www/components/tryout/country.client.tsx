"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { choiceCardVariants } from "@/components/shared/choice-card";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getTryoutExamIcon } from "@/components/tryout/icons";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

interface TryoutCountryPageClientProps {
  locale: Locale;
  publicPath: string;
}

/** Renders one realtime try-out country page from Convex. */
export function TryoutCountryPageClient({
  locale,
  publicPath,
}: TryoutCountryPageClientProps) {
  const page = useQuery(api.tryouts.queries.catalog.getCountryPage, {
    locale,
    publicPath,
  });

  if (!page) {
    return null;
  }

  if (page.exams.length === 0) {
    return <ComingSoon />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 pb-24 md:grid-cols-3">
      {page.exams.map((exam) => {
        const icon = getTryoutExamIcon(exam.examKey);

        return (
          <NavigationLink
            className={choiceCardVariants()}
            href={getTryoutPublicPathHref(exam.publicPath)}
            key={exam.examKey}
          >
            <div className="relative flex aspect-video w-full items-center justify-center">
              <GradientBlock
                className="mask-[linear-gradient(to_bottom,black_0%,black_65%,transparent_100%)] mask-no-repeat mask-size-[100%_100%] pointer-events-none absolute inset-0 opacity-20"
                colorScheme="vibrant"
                intensity="medium"
                keyString={exam.publicPath}
              />
              <HugeIcons
                aria-hidden
                className="relative size-6 text-foreground"
                icon={icon}
              />
            </div>
            <div className="px-6 pt-3 pb-6 text-center">
              <h2>{exam.title}</h2>
            </div>
          </NavigationLink>
        );
      })}
    </div>
  );
}
