import { cn, slugify } from "@/lib/utils";
import type { HeadingProps, HeadingTag } from "@/types/markdown";
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
      id={id}
      className={cn(
        "mt-10 mb-6 flex scroll-mt-44 items-center font-medium leading-tight tracking-tight",
        className
      )}
      {...props}
    >
      <a
        href={`#${id}`}
        title={props.children?.toString()}
        className="group inline-flex items-center gap-2"
        aria-label={`Link to ${props.children}`}
      >
        <span className="text-pretty">{props.children}</span>
        <LinkIcon className="invisible size-4 text-muted-foreground group-hover:visible" />
      </a>
    </Tag>
  );
}
