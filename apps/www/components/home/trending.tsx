"use client";

import { ArrowDown02Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { getTrendingTimeRange } from "@repo/backend/convex/subjectSections/utils";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
    return (
      <Button
        className="w-fit"
        nativeButton={false}
        render={
          <NavigationLink href="/search">
            <HugeIcons className="size-4" icon={Search02Icon} />
            {t("explore-materials")}
          </NavigationLink>
        }
        variant="outline"
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3">
        {t("trending-subjects")}
        <HugeIcons className="size-4" icon={ArrowDown02Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {data?.map((subject) => {
          return (
            <NavigationLink
              className="group grid gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              href={`/${subject.slug}`}
              key={subject.id}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/5">
                  <HugeIcons
                    className="size-4 text-primary"
                    icon={getMaterialIcon(subject.material)}
                  />
                </div>
                <div className="-mt-1 flex flex-col">
                  <h3>{subject.title}</h3>
                  <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground/80 sm:mr-12">
                    {subject.description}
                  </span>
                </div>
              </div>
            </NavigationLink>
          );
        })}
      </div>

      <Button
        className="w-fit"
        nativeButton={false}
        render={
          <NavigationLink href="/search">
            <HugeIcons className="size-4" icon={Search02Icon} />
            {t("explore-materials")}
          </NavigationLink>
        }
        variant="ghost"
      />
    </section>
  );
}
