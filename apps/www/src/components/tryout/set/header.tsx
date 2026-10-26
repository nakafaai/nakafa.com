import { Option } from "effect";
import type { ReactNode } from "react";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import type { SetPage } from "@/components/tryout/set/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";

/**
 * Renders the set heading with its exam and track path. The exam links only
 * while the page shows the current catalog version of the set.
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
  page: Pick<SetPage, "exam" | "set" | "track">;
  returnPath: string;
}) {
  return (
    <TryoutPageHeader
      items={[
        {
          label: page.exam.title,
          target:
            currentPath === page.set.publicPath
              ? Option.getOrUndefined(
                  getTryoutCrumbTarget(page.exam.publicPath)
                )
              : undefined,
        },
        {
          label: page.track.title,
          target: Option.getOrUndefined(getTryoutCrumbTarget(returnPath)),
        },
      ]}
      title={page.set.title}
    >
      {children}
    </TryoutPageHeader>
  );
}
