"use client";

import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import {
  BreadcrumbHeaderFold,
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { HOME_TARGET, TRYOUT_TARGET } from "@/lib/routing/target";

/**
 * Keeps navigation, heading, and the primary action in one row at every width. On a
 * phone the path folds whole into its menu, as Google Drive folds it, so the page's
 * name sits beside it; from md the path, the centred name and the action stand apart.
 */
export function TryoutPageHeader({
  children,
  items,
  title,
}: {
  /** The page's action, at the end of the header. */
  children?: ReactNode;
  items: readonly BreadcrumbHeaderItem[];
  title: string;
}) {
  const tCommon = useTranslations("Common");
  const path: readonly BreadcrumbHeaderItem[] = [
    {
      label: tCommon("try-out-short"),
      target: TRYOUT_TARGET,
    },
    ...items,
  ];
  return (
    <BreadcrumbHeaderFrame contentClassName="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4">
      <div className="min-w-0">
        <BreadcrumbHeaderFold
          className="md:hidden"
          home={HOME_TARGET}
          homeLabel={tCommon("home")}
          items={path}
        />
        <div className="min-w-0 max-md:hidden">
          <BreadcrumbHeaderPath
            home={HOME_TARGET}
            homeLabel={tCommon("home")}
            items={path}
            visibleItemCount={1}
          />
        </div>
      </div>
      <h1
        className="min-w-0 truncate font-medium text-base md:max-w-xs md:text-center"
        title={title}
      >
        {title}
      </h1>
      <div className="flex shrink-0 justify-end">{children}</div>
    </BreadcrumbHeaderFrame>
  );
}

/**
 * Fills the screen below the app header, so the page body can stretch to the
 * screen edge. The header hides from the large breakpoint and while a section
 * runs, when the shell sets its offset to zero.
 */
export function TryoutPage({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[calc(100svh-var(--app-header-top))] flex-col lg:min-h-svh"
      data-slot="tryout-page"
    >
      {children}
    </div>
  );
}

/**
 * Owns the body width and spacing shared by sets and timed sections. It fills
 * the height TryoutPage leaves below the page header, so a locked review can
 * end at the screen edge.
 */
export function TryoutPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-6 px-6 py-6">
      {children}
    </div>
  );
}
