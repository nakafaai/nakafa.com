import { cn } from "@/lib/utils";
import type { HeadingProps, HeadingTag } from "@/types/markdown";
import { LinkIcon } from "lucide-react";
import Balancer from "react-wrap-balancer";

export function Heading({
  Tag,
  className,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
} & HeadingProps) {
  const id = props.children?.toString().toLowerCase().replace(/\s+/g, "-");
  return (
    <Tag
      id={id}
      className={cn(
        "group mt-10 mb-6 flex scroll-mt-24 items-center font-medium leading-tight tracking-tight",
        className
      )}
      {...props}
    >
      <span className="inline-block">
        <Balancer>{props.children}</Balancer>
      </span>
      <a
        href={`#${id}`}
        className="invisible ml-2 shrink-0 text-muted-foreground group-hover:visible"
        aria-label={`Link to ${props.children}`}
      >
        <LinkIcon className="size-4" />
      </a>
    </Tag>
  );
}
