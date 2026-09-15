"use client";

import { Progress03Icon, Search02Icon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { MaterialRow } from "@/components/home/material-row";

type RecentlyViewedSubject = FunctionReturnType<
  typeof api.contents.queries.recent.getRecentlyViewed
>[number];

/**
 * Renders graph-backed recently viewed learning objects on the home screen.
 *
 * The route resolves the learner's ranked rows with its request credential and
 * passes them in, so the first client paint already contains the row list.
 * Resolving them after hydration instead would insert the section and push
 * trending content down.
 */
export function HomeContinueLearning({
  subjects,
}: {
  subjects: readonly RecentlyViewedSubject[];
}) {
  const t = useTranslations("Home");

  if (subjects.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 px-3 font-medium">
        {t("continue-learning")}
        <HugeIcons className="size-4" icon={Progress03Icon} />
      </h2>
      <div className="grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {subjects.map((subject) => (
          <MaterialRow
            key={`${subject.content_id}:${subject.contextKey}`}
            material={subject}
          />
        ))}
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
