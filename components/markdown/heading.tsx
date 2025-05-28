"use client";

import { useToc } from "@/lib/context/use-toc";
import { cn, slugify } from "@/lib/utils";
import type { HeadingProps, HeadingTag } from "@/types/markdown";
import { useIntersection } from "@mantine/hooks";
import { LinkIcon } from "lucide-react";
import { useEffect } from "react";

export function Heading({
  Tag,
  className,
  ...props
}: {
  Tag: HeadingTag;
  className: string;
} & HeadingProps) {
  const id = slugify(props.children?.toString() ?? "");

  const { handleIntersect, setActiveHeading } = useToc((context) => ({
    handleIntersect: context.handleIntersect,
    setActiveHeading: context.setActiveHeading,
  }));

  const { ref, entry } = useIntersection({
    rootMargin: "-20% 0px -60% 0px",
  });

  useEffect(() => {
    if (entry) {
      handleIntersect({ isIntersecting: entry.isIntersecting, entry });
    }
  }, [entry, handleIntersect]);

  return (
    <Tag
      ref={ref}
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
        onClick={() => setActiveHeading(id)}
      >
        <span className="text-pretty">{props.children}</span>
        <LinkIcon className="invisible size-4 text-muted-foreground group-hover:visible" />
      </a>
    </Tag>
  );
}
