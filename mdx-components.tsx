import { LinkIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { buttonVariants } from "./components/ui/button";
import NavigationLink from "./components/ui/navigation-link";
import { cn } from "./lib/utils";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

type HeadingProps = ComponentPropsWithoutRef<HeadingTag>;
type ParagraphProps = ComponentPropsWithoutRef<"p">;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type EmProps = ComponentPropsWithoutRef<"em">;
type StrongProps = ComponentPropsWithoutRef<"strong">;
type ListProps = ComponentPropsWithoutRef<"ul">;
type ListItemProps = ComponentPropsWithoutRef<"li">;

function Heading({
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
        "group mt-10 mb-6 flex items-center font-medium leading-tight tracking-tight",
        className
      )}
      {...props}
    >
      <span className="inline-block">{props.children}</span>
      <a
        href={`#${id}`}
        className="ml-2 hidden shrink-0 text-muted-foreground group-hover:inline-block"
        aria-label={`Link to ${props.children}`}
      >
        <LinkIcon className="size-4" />
      </a>
    </Tag>
  );
}

const components = {
  h1: (props: HeadingProps) => (
    <Heading Tag="h1" className="text-3xl" {...props} />
  ),
  h2: (props: HeadingProps) => (
    <Heading Tag="h2" className="text-2xl" {...props} />
  ),
  h3: (props: HeadingProps) => (
    <Heading Tag="h3" className="text-xl" {...props} />
  ),
  h4: (props: HeadingProps) => (
    <Heading Tag="h4" className="text-lg" {...props} />
  ),
  h5: (props: HeadingProps) => (
    <Heading Tag="h5" className="text-base" {...props} />
  ),
  h6: (props: HeadingProps) => (
    <Heading Tag="h6" className="text-sm" {...props} />
  ),
  p: (props: ParagraphProps) => (
    <p
      className="mb-4 text-base text-foreground/80 leading-relaxed last:mb-0"
      {...props}
    />
  ),
  ol: (props: ListProps) => (
    <ol className="list-decimal space-y-2 pl-5" {...props} />
  ),
  ul: (props: ListProps) => (
    <ul className="list-disc space-y-1 pl-5" {...props} />
  ),
  li: (props: ListItemProps) => (
    <li className="pl-1 text-foreground/80" {...props} />
  ),
  em: (props: EmProps) => <em className="font-medium" {...props} />,
  strong: (props: StrongProps) => (
    <strong className="font-medium text-foreground" {...props} />
  ),
  a: ({ href, children, ...props }: AnchorProps) => {
    const className = cn(buttonVariants({ variant: "link" }), "px-0");
    if (href?.startsWith("/")) {
      return (
        <NavigationLink href={href} className={className} {...props}>
          {children}
        </NavigationLink>
      );
    }
    if (href?.startsWith("#")) {
      return (
        <a href={href} className={className} {...props}>
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...props}
      >
        {children}
      </a>
    );
  },
};

declare global {
  type MDXProvidedComponents = typeof components;
}

export function useMDXComponents(): MDXProvidedComponents {
  return components;
}
