"use client";

import { cn } from "cn";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  BreadcrumbHeaderFold,
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import {
  PageActions,
  PageHeader,
  PageTitle,
} from "@/components/shared/page/header";
import {
  pageRhythmVariants,
  pageRowVariants,
} from "@/components/shared/page/width";
import { HOME_TARGET, TRYOUT_TARGET } from "@/lib/routing/target";

/**
 * Keeps navigation, heading, and the primary action in one row at every width. On a
 * phone the path folds whole into its menu, as Google Drive folds it, so the page's
 * name sits beside it; from md the path, the centred name and the action stand apart.
 * "Set 1" means nothing without its path, so the heading says the path to readers and
 * crawlers that do not see the row.
 */
export function TryoutPageHeader({
  children,
  items,
  title,
}: {
  /** The page's actions, at the end of the header. */
  children?: ReactNode;
  items: readonly BreadcrumbHeaderItem[];
  title: string;
}) {
  const tCommon = useTranslations("Common");
  const path = useTryoutPath(items);
  return (
    <PageHeader>
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
      <PageTitle title={title}>
        <span className="sr-only">
          {Arr.join(
            Arr.map(path, (item) => item.label),
            " "
          )}{" "}
        </span>
        {title}
      </PageTitle>
      <PageActions>{children}</PageActions>
    </PageHeader>
  );
}

/** A try-out page's path: the try-out root under Home, then the page's own items. */
export function useTryoutPath(
  items: readonly BreadcrumbHeaderItem[]
): readonly BreadcrumbHeaderItem[] {
  const tCommon = useTranslations("Common");
  return [{ label: tCommon("try-out-short"), target: TRYOUT_TARGET }, ...items];
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
    <div
      className={cn(
        pageRowVariants(),
        pageRhythmVariants(),
        "flex flex-1 flex-col space-y-6"
      )}
    >
      {children}
    </div>
  );
}
