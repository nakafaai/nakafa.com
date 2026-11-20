import { ArrowRight01Icon, FolderTreeIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { RenderableProps } from "@repo/design-system/lib/render";
import { renderElement } from "@ui-sdk/react/primitive";
import { cn } from "cn";
import type * as React from "react";

/**
 * The path to the page, which is the navigation of the page's header. Each step links to its page, and the last
 * names the page itself.
 */
function Breadcrumb({
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  /** The name of the navigation landmark, in the reader's language. */
  "aria-label": string;
}) {
  return <nav className={cn(className)} data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm wrap-break-word",
        className
      )}
      data-slot="breadcrumb-list"
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="breadcrumb-item"
      {...props}
    />
  );
}

function BreadcrumbLink({ className, render, ...props }: RenderableProps<"a">) {
  return renderElement(
    "a",
    {
      "data-slot": "breadcrumb-link",
      ...props,
      className: cn("hover:text-foreground transition-colors", className),
    },
    render
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-current="page"
      aria-disabled="true"
      className={cn("text-foreground font-normal", className)}
      data-slot="breadcrumb-page"
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      data-slot="breadcrumb-separator"
      role="presentation"
      {...props}
    >
      {children ?? (
        <HugeIcons className="cn-rtl-flip" icon={ArrowRight01Icon} />
      )}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        className
      )}
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      {...props}
    >
      <HugeIcons icon={FolderTreeIcon} />
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
