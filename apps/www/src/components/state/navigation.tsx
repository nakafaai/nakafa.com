import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";

interface ActionNavigationProps {
  /** Where it leads, as a path of the app: the locale is added. */
  href: string;
  label: string;
  variant: "default" | "ghost";
}

/**
 * A way on from a full-page state that stands inside the app, such as a page
 * that cannot be found: it navigates in the app, so the app stays loaded. It is
 * a module of its own, so the states that may be shown because the app broke
 * never load the app's navigation.
 */
export function ActionNavigation({
  href,
  label,
  variant,
}: ActionNavigationProps) {
  return (
    <NavigationLink className={buttonVariants({ variant })} href={href}>
      {label}
    </NavigationLink>
  );
}
