"use client";

import type { Ref } from "@confect/core";

import { Progress03Icon, Search02Icon } from "@hugeicons/core-free-icons";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";

import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MaterialRow } from "@/components/home/material";

type RecentlyViewedSubject = Ref.Returns<
  typeof contents.queries.recent.getRecentlyViewed
>[number];

/**
 * Renders graph-backed recently viewed learning objects on the home screen.
 *
 * The route resolves the learner's ranked rows with its request credential and
 * passes them in, so the first client paint already contains the row list.
 * Resolving them after hydration instead would insert the section and push
 * trending content down. The route also resolves the look of each row, because
 * the families of icons that a row picks from stay out of the client bundle.
 */
export function HomeContinueLearning({
  looks,
  subjects,
}: {
  looks: readonly TileLook[];
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
        {Arr.zipWith(subjects, looks, (subject, look) => (
          <MaterialRow
            key={`${subject.content_id}:${subject.contextKey}`}
            look={look}
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
