"use client";

import { useToc } from "@/lib/context/use-toc";
import { cn, slugify } from "@/lib/utils";
import type { HeadingProps, HeadingTag } from "@/types/markdown";
import { LinkIcon } from "lucide-react";
import { useIntersectionObserver } from "usehooks-ts";

export function Heading({
  Tag,
  className,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
} & HeadingProps) {
  const id = slugify(props.children?.toString() ?? "");

  const handleIntersect = useToc((context) => context.handleIntersect);

  const { ref } = useIntersectionObserver({
    onChange(isIntersecting, entry) {
      if (entry) {
        handleIntersect({ isIntersecting, entry });
      }
    },
    rootMargin: "-20% 0px -70% 0px",
  });

  return (
    <Tag
      ref={ref}
      id={id}
      className={cn(
        "mt-10 mb-6 flex scroll-mt-28 items-center font-medium leading-tight tracking-tight",
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
