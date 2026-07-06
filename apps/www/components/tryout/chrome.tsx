import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ReactNode } from "react";

export type TryoutBreadcrumbItem = Readonly<{
  href?: string;
  label: string;
}>;

/** Renders the sticky try-out navigation header used by chooser pages. */
export function TryoutHeader({
  action,
  homeLabel,
  items,
  title,
}: {
  action?: ReactNode;
  homeLabel: string;
  items: readonly TryoutBreadcrumbItem[];
  title: string;
}) {
  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <h1 className="sr-only">{title}</h1>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <NavigationLink href="/home">{homeLabel}</NavigationLink>
                }
              />
            </BreadcrumbItem>
            {items.map((item, index) => (
              <TryoutBreadcrumbSegment
                isCurrent={index === items.length - 1}
                item={item}
                key={`${item.label}:${item.href ?? "current"}`}
              />
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        {action}
      </div>
    </header>
  );
}

function TryoutBreadcrumbSegment({
  isCurrent,
  item,
}: {
  isCurrent: boolean;
  item: TryoutBreadcrumbItem;
}) {
  if (isCurrent || !item.href) {
    return (
      <>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{item.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    );
  }

  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink
          render={
            <NavigationLink href={item.href}>{item.label}</NavigationLink>
          }
        />
      </BreadcrumbItem>
    </>
  );
}
