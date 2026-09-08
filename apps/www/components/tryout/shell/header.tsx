"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BreadcrumbHeaderFrame } from "@/components/shared/breadcrumb/frame";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";

/** Keeps navigation, heading, and the primary action in one stable page row. */
export function TryoutPageHeader({
  action,
  items,
  title,
}: {
  action: ReactNode;
  items: readonly BreadcrumbHeaderItem[];
  title: string;
}) {
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeaderFrame contentClassName="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <BreadcrumbHeaderPath
          homeLabel={tCommon("home")}
          items={[
            { href: "/try-out", label: tCommon("try-out-short") },
            ...items,
          ]}
          menuLabel={tCommon("more")}
        />
      </div>
      <h1
        className="min-w-0 truncate font-medium text-sm sm:text-center"
        title={title}
      >
        {title}
      </h1>
      <div className="flex min-w-0 justify-end [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:text-start">
        {action}
      </div>
    </BreadcrumbHeaderFrame>
  );
}

/** Owns the body width and spacing shared by sets and timed sections. */
export function TryoutPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-6">
      {children}
    </div>
  );
}
