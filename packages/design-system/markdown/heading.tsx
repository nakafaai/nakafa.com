import { cn, slugify } from "@repo/design-system/lib/utils";
import type {
  HeadingProps,
  HeadingTag,
} from "@repo/design-system/types/markdown";
import { LinkIcon } from "lucide-react";

export function Heading({
  Tag,
  className,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
} & HeadingProps) {
  const id = slugify(props.children?.toString() ?? "");

  return (
    <Tag
      className={cn(
        "mt-10 mb-6 flex scroll-mt-44 items-center font-medium leading-tight tracking-tight",
        className
      )}
      id={id}
      {...props}
    >
      <a
        aria-label={`Link to ${props.children}`}
        className="group inline-flex items-center gap-2"
        href={`#${id}`}
        title={props.children?.toString()}
      >
        <span className="text-pretty">{props.children}</span>
        <LinkIcon className="invisible size-4 text-muted-foreground group-hover:visible" />
      </a>
    </Tag>
  );
}
