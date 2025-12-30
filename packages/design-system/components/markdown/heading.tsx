import { Link05Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn, createHeadingId } from "@repo/design-system/lib/utils";
import type {
  HeadingProps,
  HeadingTag,
} from "@repo/design-system/types/markdown";
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
  if (typeof node === "object" && "props" in node && node.props) {
    const props = node.props as Record<string, unknown>;

    // Handle InlineMath and BlockMath components (content is in 'math' prop)
    if ("math" in props && typeof props.math === "string") {
      return props.math;
    }

    // Handle regular React elements (content is in 'children')
    if ("children" in props) {
      return extractTextFromNode(props.children as ReactNode);
    }
  }
  return "";
}

export function Heading({
  Tag,
  className,
  enableLink = true,
  id: explicitId,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
  enableLink?: boolean;
  id?: string;
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
        <span className="text-pretty">{props.children}</span>
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
        className="group/heading inline-flex items-center gap-4"
        href={`#${id}`}
        title={props.children?.toString()}
      >
        <span className="text-pretty">{props.children}</span>
        <div className="rounded-sm border p-2 opacity-0 transition-opacity ease-out group-hover/heading:opacity-100">
          <HugeIcons
            className="size-4 shrink-0 text-muted-foreground"
            icon={Link05Icon}
          />
        </div>
      </a>
    </Tag>
  );
}
