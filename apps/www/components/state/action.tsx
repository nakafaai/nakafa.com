import { Button } from "@repo/design-system/components/ui/button";
import { buttonVariants } from "@repo/design-system/lib/button";

interface ActionLinkProps {
  href: string;
  label: string;
  variant: "default" | "ghost";
}

/**
 * A way on from a full-page state, to another page, as a plain link so that
 * the browser does the navigation. A state that may be shown because the app
 * broke, or that stands without the app, uses it. Inside the app,
 * `ActionNavigation` keeps the app loaded instead.
 */
export function ActionLink({ href, label, variant }: ActionLinkProps) {
  return (
    <a className={buttonVariants({ variant })} href={href}>
      {label}
    </a>
  );
}

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant: "default" | "ghost";
}

/**
 * A way on from a full-page state that does something here, such as trying
 * again.
 */
export function ActionButton({ label, onClick, variant }: ActionButtonProps) {
  return (
    <Button onClick={onClick} variant={variant}>
      {label}
    </Button>
  );
}
