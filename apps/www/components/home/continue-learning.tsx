"use client";

import { Search02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cleanSlug } from "@repo/utilities/helper";
import { useLocale, useTranslations } from "next-intl";

export function HomeContinueLearning() {
  const t = useTranslations("Home");
  const locale = useLocale();

  const { data, isPending } = useQueryWithStatus(
    api.contents.queries.getRecentlyViewed,
    {
      locale,
      limit: 5,
    }
  );

  if (isPending) {
    return null;
  }

  if (!data || data.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="sr-only px-3">{t("continue-learning")}</h2>
        <Empty className="items-start md:p-0">
          <EmptyHeader className="items-start">
            <EmptyTitle>{t("no-recent-views")}</EmptyTitle>
            <EmptyDescription>
              {t("no-recent-views-description")}
            </EmptyDescription>
          </EmptyHeader>
          <Button
            className="w-fit"
            nativeButton={false}
            render={
              <NavigationLink href="/search">
                <HugeIcons className="size-4" icon={Search02Icon} />
                {t("start-learning")}
              </NavigationLink>
            }
            variant="outline"
          />
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="px-3 font-medium">{t("continue-learning")}</h2>
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
                <div className="-mt-1 flex flex-col gap-0.5">
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
