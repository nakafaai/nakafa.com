import type { ReactNode } from "react";
import { getTryoutCrumbTarget } from "@/components/tryout/route/path";
import type { SetPage } from "@/components/tryout/set/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";

/**
 * Renders the set heading with its exam and track path. The exam links only
 * while the page shows the current catalog version of the set.
 */
export function TryoutSetPageHeader({
  action,
  currentPath,
  page,
  returnPath,
}: {
  action: ReactNode;
  currentPath: string;
  page: Pick<SetPage, "exam" | "set" | "track">;
  returnPath: string;
}) {
  return (
    <TryoutPageHeader
      action={action}
      items={[
        {
          label: page.exam.title,
          target:
            currentPath === page.set.publicPath
              ? getTryoutCrumbTarget(page.exam.publicPath)
              : undefined,
        },
        {
          label: page.track.title,
          target: getTryoutCrumbTarget(returnPath),
        },
      ]}
      title={page.set.title}
    />
  );
}
