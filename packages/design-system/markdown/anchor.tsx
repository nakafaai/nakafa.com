import { buttonVariants } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { AnchorProps } from "@repo/design-system/types/markdown";

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
      <a className={className} href={href} title={href} {...props}>
        {children}
      </a>
    );
  }
  return (
    <a
      className={className}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      title={href}
      {...props}
    >
      {children}
    </a>
  );
}
