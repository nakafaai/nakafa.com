import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ContentPagination } from "@repo/contents/content";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { TargetLink } from "@/lib/routing/link";
import { publicPathTarget } from "@/lib/routing/target";

interface Props {
  className?: string;
  pagination: ContentPagination;
}

/**
 * Links one neighbouring page, or keeps its column without a link when there
 * is none. The link loads the page's content once the reader hovers, focuses or
 * touches it, as every link does by the router's default.
 */
function PaginationItem({
  context,
  publicPath,
  title,
  label,
  icon,
  className,
  iconPosition = "right",
}: {
  context?: string | undefined;
  publicPath: string;
  title: string;
  label: string;
  icon: IconSvgElement;
  className?: string;
  iconPosition?: "left" | "right";
}) {
  const itemClassName = cn(
    buttonVariants({ variant: "outline" }),
    "group flex h-auto flex-col py-3 whitespace-normal shadow-xs",
    className
  );
  return Option.match(publicPathTarget(publicPath, context), {
    onNone: () => (
      <div
        aria-hidden="true"
        className={cn(
          itemClassName,
          "pointer-events-none hidden opacity-50 sm:flex"
        )}
      >
        <PaginationLabel
          icon={icon}
          iconPosition={iconPosition}
          label={label}
          title={title}
        />
      </div>
    ),
    onSome: (target) => (
      <TargetLink className={itemClassName} target={target} title={title}>
        <PaginationLabel
          icon={icon}
          iconPosition={iconPosition}
          label={label}
          title={title}
        />
      </TargetLink>
    ),
  });
}

/** The direction and the title of one neighbouring page, with the arrow on the side it points to. */
function PaginationLabel({
  icon,
  iconPosition,
  label,
  title,
}: {
  icon: IconSvgElement;
  iconPosition: "left" | "right";
  label: string;
  title: string;
}) {
  return (
    <>
      <div className="text-muted-foreground group-hover:text-accent-foreground flex items-center gap-2 text-sm font-normal transition-colors">
        {iconPosition === "left" && (
          <HugeIcons className="size-4 shrink-0" icon={icon} />
        )}
        {label}
        {iconPosition === "right" && (
          <HugeIcons className="size-4 shrink-0" icon={icon} />
        )}
      </div>
      <p
        className={cn(
          "text-foreground group-hover:text-accent-foreground w-full transition-colors",
          iconPosition === "right" ? "text-right" : ""
        )}
      >
        {title}
      </p>
    </>
  );
}

/**
 * Links the previous and next page. Neither loads its page before the reader
 * shows intent: a lesson's answer is small on the wire but about half a megabyte
 * for a phone to read, so no page loads one the reader may never open.
 *
 * It follows the page's article, and shows only once the article has its body:
 * after a client navigation the body of a server component arrives a moment
 * after the page around it, and links drawn before it would be pushed down.
 */
export function PaginationContent({ pagination, className }: Props) {
  const t = useTranslations("Common");

  return (
    <nav
      aria-label={t("page-navigation")}
      className={cn("mt-10 pt-10 [article:empty~&]:hidden", className)}
    >
      <div className="mx-auto grid max-w-3xl gap-6 px-6 sm:grid-cols-2">
        <PaginationItem
          className="items-start"
          context={pagination.prev.context}
          icon={ArrowLeft02Icon}
          iconPosition="left"
          label={t("previous")}
          publicPath={pagination.prev.publicPath}
          title={pagination.prev.title}
        />

        <PaginationItem
          className="items-end"
          context={pagination.next.context}
          icon={ArrowRight02Icon}
          iconPosition="right"
          label={t("next")}
          publicPath={pagination.next.publicPath}
          title={pagination.next.title}
        />
      </div>
    </nav>
  );
}
