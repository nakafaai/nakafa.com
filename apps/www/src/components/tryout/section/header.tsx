import { Option } from "effect";
import type { ComponentProps, ReactNode } from "react";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import {
  TryoutPageHeader,
  useTryoutPath,
} from "@/components/tryout/shell/header";

/**
 * Renders the section heading with its exam and group, its track, and its set.
 * The group and track link only while the page sits at the section's current
 * catalog path; an attempt kept from an earlier catalog version leaves them
 * unlinked.
 */
export function TryoutSectionPageHeader({
  children,
  page,
  parents,
  setPath,
}: {
  /** The page's action, at the end of the header. */
  children: ReactNode;
  page: TryoutSectionPage;
  parents: "linked" | "unlinked";
  setPath: string;
}) {
  return (
    <TryoutPageHeader
      items={sectionCrumbs({ page, parents, setPath })}
      title={page.section.title}
    >
      {children}
    </TryoutPageHeader>
  );
}

/**
 * The player's path to a running section: the try-out root, the section's exam and group, its track and its set,
 * then the section itself, which the player's header ends on.
 */
export function useTryoutPlayerPath(
  where: Omit<ComponentProps<typeof TryoutSectionPageHeader>, "children">
): readonly BreadcrumbHeaderItem[] {
  return useTryoutPath([
    ...sectionCrumbs(where),
    { label: where.page.section.title },
  ]);
}

/**
 * The items between the try-out root and a section: its exam and group, its track and its set. The group and the
 * track link only while the page sits at the section's current catalog path.
 */
function sectionCrumbs({
  page,
  parents,
  setPath,
}: Omit<
  ComponentProps<typeof TryoutSectionPageHeader>,
  "children"
>): readonly BreadcrumbHeaderItem[] {
  return [
    {
      label: `${page.exam.title} ${page.group.title}`,
      target:
        parents === "linked"
          ? Option.getOrUndefined(getTryoutCrumbTarget(page.group.publicPath))
          : undefined,
    },
    {
      label: page.track.title,
      target:
        parents === "linked"
          ? Option.getOrUndefined(getTryoutCrumbTarget(page.track.publicPath))
          : undefined,
    },
    {
      label: page.set.title,
      target: Option.getOrUndefined(getTryoutCrumbTarget(setPath)),
    },
  ];
}
