import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { AnchorProps } from "@repo/design-system/types/markdown";
import { Source, SourceContent, SourceTrigger } from "../ai/source";

export function Anchor({
  href,
  children,
  popover,
  className,
  ...props
}: AnchorProps) {
  // No href - do not render anything
  if (!href) {
    return null;
  }

  // Internal navigation
  if (href.startsWith("/")) {
    return (
      <NavigationLink
        className={cn(
          "h-auto p-0 font-normal text-primary underline underline-offset-4",
          className
        )}
        href={href}
        title={href}
        {...props}
      >
        {children}
      </NavigationLink>
    );
  }

  // Hash anchors, mailto, and tel links
  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return (
      <a
        className={cn(
          "h-auto p-0 font-normal text-primary underline underline-offset-4",
          className
        )}
        href={href}
        title={href}
        {...(popover !== undefined && { popover })}
        {...props}
      >
        {children}
      </a>
    );
  }

  // External link with source preview
  return (
    <Source href={href}>
      <SourceTrigger showFavicon />
      <SourceContent title={href} />
    </Source>
  );
}
