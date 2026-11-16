import { Option } from "effect";
import type { ComponentProps, ReactNode } from "react";
import type { BreadcrumbHeaderItem } from "@/components/shared/breadcrumb/header";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import type { SetPage } from "@/components/tryout/set/model";
import {
  TryoutPageHeader,
  useTryoutPath,
} from "@/components/tryout/shell/header";

/**
 * Renders the set heading with its exam and group, and its track. The group
 * links only while the page shows the current catalog version of the set.
 */
export function TryoutSetPageHeader({
  children,
  currentPath,
  page,
  returnPath,
}: {
  /** The page's action, at the end of the header. */
  children: ReactNode;
  currentPath: string;
  page: Pick<SetPage, "exam" | "group" | "set" | "track">;
  returnPath: string;
}) {
  return (
    <TryoutPageHeader
      items={setCrumbs({ currentPath, page, returnPath })}
      title={page.set.title}
    >
      {children}
    </TryoutPageHeader>
  );
}

/** The player's path to a set's entry section: the try-out root, the set's exam and group, its track, then the set. */
export function useTryoutSetPath(
  where: Omit<ComponentProps<typeof TryoutSetPageHeader>, "children">
): readonly BreadcrumbHeaderItem[] {
  return useTryoutPath([...setCrumbs(where), { label: where.page.set.title }]);
}

/**
 * The items between the try-out root and a set: its exam and group, and its track. The group links only while the
 * page shows the current catalog version of the set.
 */
function setCrumbs({
  currentPath,
  page,
  returnPath,
}: Omit<
  ComponentProps<typeof TryoutSetPageHeader>,
  "children"
>): readonly BreadcrumbHeaderItem[] {
  return [
    {
      label: `${page.exam.title} ${page.group.title}`,
      target:
        currentPath === page.set.publicPath
          ? Option.getOrUndefined(getTryoutCrumbTarget(page.group.publicPath))
          : undefined,
    },
    {
      label: page.track.title,
      target: Option.getOrUndefined(getTryoutCrumbTarget(returnPath)),
    },
  ];
}
