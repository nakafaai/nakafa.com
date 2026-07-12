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
import type { ReactNode } from "react";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";

const VISIBLE_PATH_ITEM_COUNT = 2;

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
  const hiddenItems = items.slice(0, -VISIBLE_PATH_ITEM_COUNT);
  const visibleItems = items.slice(-VISIBLE_PATH_ITEM_COUNT);

  return (
    <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <h1 className="sr-only">{title}</h1>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={
                  <TryoutIntentLink href="/home">{homeLabel}</TryoutIntentLink>
                }
              />
            </BreadcrumbItem>
            {hiddenItems.length > 0 ? (
              <TryoutBreadcrumbMenu items={hiddenItems} />
            ) : null}
            {visibleItems.map((item, index) => (
              <TryoutBreadcrumbSegment
                isCurrent={index === visibleItems.length - 1}
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
                      <TryoutIntentLink href={item.href}>
                        {item.menuLabel ?? item.label}
                      </TryoutIntentLink>
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

/** Render one visible current or linked try-out breadcrumb segment. */
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
            <TryoutIntentLink href={item.href}>{item.label}</TryoutIntentLink>
          }
        />
      </BreadcrumbItem>
    </>
  );
}
