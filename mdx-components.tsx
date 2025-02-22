import type { ComponentPropsWithoutRef } from "react";
import { buttonVariants } from "./components/ui/button";
import { Link } from "./i18n/routing";
import { cn } from "./lib/utils";

type HeadingProps = ComponentPropsWithoutRef<
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
>;
type ParagraphProps = ComponentPropsWithoutRef<"p">;
type AnchorProps = ComponentPropsWithoutRef<"a">;
type EmProps = ComponentPropsWithoutRef<"em">;
type StrongProps = ComponentPropsWithoutRef<"strong">;

const components = {
  h1: (props: HeadingProps) => (
    <h1 className="mt-10 mb-6 font-medium text-3xl" {...props} />
  ),
  h2: (props: HeadingProps) => (
    <h2 className="mt-10 mb-6 font-medium text-2xl" {...props} />
  ),
  h3: (props: HeadingProps) => (
    <h3 className="mt-10 mb-6 font-medium text-xl" {...props} />
  ),
  h4: (props: HeadingProps) => (
    <h4 className="mt-10 mb-6 font-medium text-lg" {...props} />
  ),
  h5: (props: HeadingProps) => (
    <h5 className="mt-10 mb-6 font-medium text-base" {...props} />
  ),
  h6: (props: HeadingProps) => (
    <h6 className="mt-10 mb-6 font-medium text-sm" {...props} />
  ),
  p: (props: ParagraphProps) => (
    <p
      className="mb-2 text-base text-foreground/80 leading-relaxed last:mb-0"
      {...props}
    />
  ),
  em: (props: EmProps) => <em className="font-medium" {...props} />,
  strong: (props: StrongProps) => <strong className="font-medium" {...props} />,
  a: ({ href, children, ...props }: AnchorProps) => {
    const className = cn(buttonVariants({ variant: "link" }), "px-0");
    if (href?.startsWith("/")) {
      return (
        <Link href={href} className={className} {...props}>
          {children}
        </Link>
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
