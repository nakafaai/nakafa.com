import { buttonVariants } from "@repo/design-system/lib/button";
import { Link, type LinkTarget } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

interface ActionNavigationProps {
  label: string;
  /** Where it leads, as a route of the app: the locale is the one of the page on screen. */
  target: LinkTarget;
  variant: "default" | "ghost";
}

/**
 * A way on from a full-page state that stands inside the app, such as a page
 * that cannot be found: it navigates in the app, so the app stays loaded. It is
 * a module of its own, so the states that may be shown because the app broke
 * never load the app's navigation.
 */
export function ActionNavigation({
  label,
  target,
  variant,
}: ActionNavigationProps) {
  return (
    <Link
      activeOptions={EXACT_ACTIVE_OPTIONS}
      className={buttonVariants({ variant })}
      {...target}
    >
      {label}
    </Link>
  );
}
