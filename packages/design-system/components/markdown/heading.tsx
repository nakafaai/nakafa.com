import { cn, slugify } from "@repo/design-system/lib/utils";
import type {
  HeadingProps,
  HeadingTag,
} from "@repo/design-system/types/markdown";
import { Link2Icon } from "lucide-react";

export function Heading({
  Tag,
  className,
  enableLink = true,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
  enableLink?: boolean;
} & HeadingProps) {
  const id = slugify(props.children?.toString() ?? "");

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
          <Link2Icon className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </a>
    </Tag>
  );
}
