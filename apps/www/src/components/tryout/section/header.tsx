import type { ReactNode } from "react";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { TryoutPageHeader } from "@/components/tryout/shell/header";

/**
 * Renders the section heading with its exam, track, and set path. The exam
 * and track link only while the page sits at the section's current catalog
 * path; an attempt kept from an earlier catalog version leaves them unlinked.
 */
export function TryoutSectionPageHeader({
  action,
  page,
  parents,
  setHref,
}: {
  action: ReactNode;
  page: TryoutSectionPage;
  parents: "linked" | "unlinked";
  setHref: string;
}) {
  return (
    <TryoutPageHeader
      action={action}
      items={[
        {
          href:
            parents === "linked"
              ? getTryoutPublicPathHref(page.exam.publicPath)
              : undefined,
          label: page.exam.title,
        },
        {
          href:
            parents === "linked"
              ? getTryoutPublicPathHref(page.track.publicPath)
              : undefined,
          label: page.track.title,
        },
        { href: setHref, label: page.set.title },
      ]}
      title={page.section.title}
    />
  );
}
