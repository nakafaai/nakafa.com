import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/design-system/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ReactNode } from "react";

export type TryoutBreadcrumbItem = Readonly<{
  href?: string;
  label: string;
  menuLabel?: string;
}>;

/** Cohesive render model for the sticky try-out breadcrumb header. */
export interface TryoutHeaderValue {
  action?: ReactNode;
  homeLabel: string;
  items: readonly TryoutBreadcrumbItem[];
  title: string;
}

/** Renders the sticky try-out navigation header used by chooser pages. */
export function TryoutHeader({ value }: { value: TryoutHeaderValue }) {
  const { action, homeLabel, items, title } = value;
  const currentItem = items.at(-1) ?? null;
  const hiddenItems = currentItem ? items.slice(0, -1) : items;

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
            {hiddenItems.length > 0 ? (
              <TryoutBreadcrumbMenu items={hiddenItems} />
            ) : null}
            {currentItem ? (
              <TryoutBreadcrumbSegment isCurrent item={currentItem} />
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
        {action}
      </div>
    </header>
  );
}

/** Renders collapsed middle breadcrumb items inside an ellipsis menu. */
function TryoutBreadcrumbMenu({
  items,
}: {
  items: readonly TryoutBreadcrumbItem[];
}) {
  return (
    <>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                aria-label="Open breadcrumb menu"
                className="flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
              >
                <BreadcrumbEllipsis />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Menu</DropdownMenuLabel>
              {items.map((item) => (
                <DropdownMenuItem
                  key={`${item.label}:${item.href ?? "current"}`}
                  render={
                    item.href ? (
                      <NavigationLink href={item.href}>
                        {item.menuLabel ?? item.label}
                      </NavigationLink>
                    ) : (
                      <span>{item.menuLabel ?? item.label}</span>
                    )
                  }
                />
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </>
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
