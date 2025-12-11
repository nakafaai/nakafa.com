import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { AnchorProps } from "@repo/design-system/types/markdown";
import { Activity } from "react";
import { Source, SourceContent, SourceTrigger } from "../ai/source";

export function Anchor({
  href,
  children,
  popover,
  className,
  ...props
}: AnchorProps) {
  const anchorOnlyProps = popover === undefined ? {} : { popover };

  if (href?.startsWith("/")) {
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

  if (href?.startsWith("#")) {
    return (
      <a
        className={cn(
          "h-auto p-0 font-normal text-primary underline underline-offset-4",
          className
        )}
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
    <Source href={href ?? ""}>
      <SourceTrigger showFavicon />
      <Activity mode={href ? "visible" : "hidden"}>
        <SourceContent title={href ?? ""} />
      </Activity>
    </Source>
  );
}
