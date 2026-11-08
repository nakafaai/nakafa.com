import { Option } from "effect";
import type { ReactNode } from "react";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";

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
      items={[
        {
          label: `${page.exam.title} ${page.group.title}`,
          target:
            parents === "linked"
              ? Option.getOrUndefined(
                  getTryoutCrumbTarget(page.group.publicPath)
                )
              : undefined,
        },
        {
          label: page.track.title,
          target:
            parents === "linked"
              ? Option.getOrUndefined(
                  getTryoutCrumbTarget(page.track.publicPath)
                )
              : undefined,
        },
        {
          label: page.set.title,
          target: Option.getOrUndefined(getTryoutCrumbTarget(setPath)),
        },
      ]}
      title={page.section.title}
    >
      {children}
    </TryoutPageHeader>
  );
}
