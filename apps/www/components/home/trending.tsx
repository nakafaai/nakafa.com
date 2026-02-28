"use client";

import { ArrowDown02Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { getTrendingTimeRange } from "@repo/backend/convex/subjectSections/utils";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { Badge } from "@repo/design-system/components/ui/badge";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cleanSlug } from "@repo/utilities/helper";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

export function HomeTrending() {
  const t = useTranslations("Home");
  const locale = useLocale();

  const timeRange = useMemo(() => {
    return getTrendingTimeRange(7);
  }, []);

  const { data, isPending } = useQueryWithStatus(
    api.subjectSections.queries.getTrendingSubjects,
    {
      locale,
      since: timeRange.since,
      until: timeRange.until,
    }
  );

  if (isPending) {
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {data.map((subject) => {
          return (
            <NavigationLink
              className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              href={`/${cleanSlug(subject.slug)}`}
              key={subject.id}
            >
              <div className="flex items-start gap-3">
                <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
                  <GradientBlock
                    className="absolute inset-0"
                    colorScheme="vibrant"
                    intensity="medium"
                    keyString={subject.id}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <HugeIcons
                      className="size-4 text-background drop-shadow-md"
                      icon={getMaterialIcon(subject.material)}
                    />
                  </div>
                </div>
                <div className="-mt-1 flex flex-1 flex-col gap-0.5">
                  <div className="relative">
                    <h3 className="pr-20">{subject.title}</h3>
                    <Badge className="absolute top-0 right-0" variant="muted">
                      <HugeIcons className="size-3" icon={ViewIcon} />
                      {subject.viewCount}
                    </Badge>
                  </div>
                  <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground/80 sm:mr-12">
                    {subject.description}
                  </span>
                </div>
              </div>
            </NavigationLink>
          );
        })}
      </div>
    </section>
  );
}
