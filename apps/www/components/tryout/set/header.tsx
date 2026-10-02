import type { ReactNode } from "react";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import type { SetPage } from "@/components/tryout/set/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";

/**
 * Renders the set heading with its exam and track path. The exam links only
 * while the page shows the current catalog version of the set.
 */
export function TryoutSetPageHeader({
  action,
  currentHref,
  page,
  returnHref,
}: {
  action: ReactNode;
  currentHref: string;
  page: Pick<SetPage, "exam" | "set" | "track">;
  returnHref: string;
}) {
  return (
    <TryoutPageHeader
      action={action}
      items={[
        {
          href:
            currentHref === getTryoutPublicPathHref(page.set.publicPath)
              ? getTryoutPublicPathHref(page.exam.publicPath)
              : undefined,
          label: page.exam.title,
        },
        { href: returnHref, label: page.track.title },
      ]}
      title={page.set.title}
    />
  );
}
