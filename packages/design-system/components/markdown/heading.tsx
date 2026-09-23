import { Link05Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  createHeadingId,
  headingTextVariants,
} from "@repo/design-system/lib/markdown/headings";
import type {
  HeadingProps,
  HeadingTag,
} from "@repo/design-system/types/markdown";
import { cn } from "cn";
import { Predicate } from "effect";
import type { ReactNode } from "react";

function extractTextFromNode(node: ReactNode): string {
  if (node === null || node === undefined) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number" || typeof node === "boolean") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join("");
  }
  if (Predicate.isObject(node) && Predicate.hasProperty(node, "props")) {
    const { props } = node;

    // Handle InlineMath and BlockMath components (content is in 'math' prop)
    if (
      Predicate.isObject(props) &&
      Predicate.hasProperty(props, "math") &&
      Predicate.isString(props.math)
    ) {
      return props.math;
    }

    // Handle regular React elements (content is in 'children')
    if (Predicate.isObject(props) && Predicate.hasProperty(props, "children")) {
      return extractTextFromNode(props.children as ReactNode);
    }
  }
  return "";
}

/**
 * Renders the text inside one heading level.
 *
 * The rule under the words marks the start of a section, so `h1` and `h2`
 * carry it from {@link headingTextVariants}. `h3` and below stay plain ink so
 * the level hierarchy reads at a glance.
 */
function HeadingText({
  children,
  Tag,
}: {
  Tag: HeadingTag;
  children: ReactNode;
}) {
  return (
    <span
      className={headingTextVariants({
        rule: Tag === "h1" || Tag === "h2" ? "section" : "none",
      })}
    >
      {children}
    </span>
  );
}

/** Renders one content heading with the shared accent ink and anchor. */
export function Heading({
  Tag,
  className,
  enableLink = true,
  id: explicitId,
  ...props
}: {
  Tag: HeadingTag;
  className?: string | undefined;
  enableLink?: boolean;
  id?: string | undefined;
} & HeadingProps) {
  const id =
    explicitId ?? createHeadingId(extractTextFromNode(props.children) ?? "");

  if (!enableLink) {
    return (
      <Tag
        className={cn(
          "mt-10 mb-6 flex items-center font-medium leading-tight tracking-tight first:mt-0 last:mb-0",
          className
        )}
        id={id}
        {...props}
      >
        <HeadingText Tag={Tag}>{props.children}</HeadingText>
      </Tag>
    );
  }

  return (
    <Tag
      className={cn(
        "mt-10 mb-6 flex scroll-mt-44 items-center font-medium leading-tight tracking-tight first:mt-0 last:mb-0",
        className
      )}
      id={id}
      {...props}
    >
      <a
        aria-label={`Link to ${props.children}`}
        className="group/heading inline-flex min-w-0 items-center gap-4"
        href={`#${id}`}
        title={props.children?.toString()}
      >
        <HeadingText Tag={Tag}>{props.children}</HeadingText>
        <div className="shrink-0 rounded-sm border p-2 opacity-0 transition-opacity ease-out group-hover/heading:opacity-100">
          <HugeIcons
            className="size-4 shrink-0 text-muted-foreground"
            icon={Link05Icon}
          />
        </div>
      </a>
    </Tag>
  );
}
