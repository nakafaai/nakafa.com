import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { AnchorProps } from "@repo/design-system/types/markdown";
import type { ReactNode } from "react";

export function Anchor({ href, children, popover, ...props }: AnchorProps) {
  const isNakafa = href?.includes("nakafa.com");
  const anchorOnlyProps = popover === undefined ? {} : { popover };

  if (href?.startsWith("/")) {
    return (
      <NavigationLink
        className="h-auto p-0 font-normal text-primary underline underline-offset-4"
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
        className="h-auto p-0 font-normal text-primary underline underline-offset-4"
        href={href}
        title={href}
        {...anchorOnlyProps}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <a
      className="h-auto p-0 font-normal text-primary underline underline-offset-4"
      href={href ?? ""}
      rel="noopener noreferrer"
      target={isNakafa ? undefined : "_blank"}
      title={href}
      {...anchorOnlyProps}
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
