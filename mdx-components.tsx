import { Heading } from "./components/markdown/heading";
import { buttonVariants } from "./components/ui/button";
import NavigationLink from "./components/ui/navigation-link";
import { cn } from "./lib/utils";
import type {
  AnchorProps,
  EmProps,
  HeadingProps,
  ListItemProps,
  ListProps,
  ParagraphProps,
  StrongProps,
} from "./types/markdown";

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
    <li className="pl-1 text-foreground/80 leading-relaxed" {...props} />
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
