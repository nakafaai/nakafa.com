import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { AnchorProps } from "@repo/design-system/types/markdown";
import type { ReactNode } from "react";

export function Anchor({ href, children, ...props }: AnchorProps) {
  const className = buttonVariants({ variant: "link" });
  if (href?.startsWith("/")) {
    return (
      <NavigationLink
        className={cn(
          className,
          "h-auto p-0 text-base underline underline-offset-4"
        )}
        href={href}
        title={href}
        {...props}
      >
        {children}
      </NavigationLink>
    );
  }
  if (href?.startsWith("#")) {
    return (
      <a
        className={cn(
          className,
          "h-auto p-0 text-base underline underline-offset-4"
        )}
        href={href}
        title={href}
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <a
      className={cn(
        className,
        "h-auto p-0 text-base underline underline-offset-4"
      )}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={href}
      {...props}
    >
      {truncate({ children })}
    </a>
  );
}

function truncate({
  children,
  maxLength = 36,
}: {
  children: ReactNode;
  maxLength?: number;
}) {
  if (typeof children === "string") {
    if (children.length <= maxLength) {
      return children;
    }
    return `${children.slice(0, maxLength)}...`;
  }
  return children;
}
