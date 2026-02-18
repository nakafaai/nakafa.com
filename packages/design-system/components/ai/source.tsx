"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { createContext, useContext } from "react";

const SourceContext = createContext<{
  href: string;
  domain: string;
} | null>(null);

function useSourceContext() {
  const ctx = useContext(SourceContext);
  if (!ctx) {
    throw new Error("Source.* must be used inside <Source>");
  }
  return ctx;
}

export interface SourceProps {
  children: React.ReactNode;
  href: string;
}

export function Source({ href, children }: SourceProps) {
  let domain = "";
  try {
    domain = new URL(href).hostname;
  } catch {
    domain = href.split("/").pop() || href;
  }

  return (
    <SourceContext.Provider value={{ href, domain }}>
      <HoverCard closeDelay={0} openDelay={150}>
        {children}
      </HoverCard>
    </SourceContext.Provider>
  );
}

export interface SourceTriggerProps {
  className?: string;
  label?: string | number;
  showFavicon?: boolean;
}

export function SourceTrigger({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain } = useSourceContext();
  const labelToShow = label ?? domain.replace("www.", "");

  return (
    <HoverCardTrigger asChild>
      <a
        className={cn(
          "inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full border border-transparent bg-muted py-0 text-muted-foreground text-xs leading-none no-underline transition-colors ease-out hover:border-primary hover:bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] hover:text-primary",
          showFavicon ? "pr-2 pl-1" : "px-1",
          className
        )}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {!!showFavicon && (
          <Image
            alt="favicon"
            className="size-3.5 rounded-full"
            fetchPriority="high"
            height={14}
            loading="eager"
            preload
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href
            )}`}
            width={14}
          />
        )}
        <span className="truncate text-center font-normal">{labelToShow}</span>
      </a>
    </HoverCardTrigger>
  );
}

export interface SourceContentProps {
  className?: string;
  description?: string;
  title: string;
}

export function SourceContent({
  title,
  description,
  className,
}: SourceContentProps) {
  const { href, domain } = useSourceContext();

  return (
    <HoverCardContent className={cn("w-80 p-0 shadow-xs", className)}>
      <a
        className="flex flex-col gap-2 p-3"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-center gap-1.5">
          <Image
            alt="favicon"
            className="size-4 rounded-full"
            height={16}
            src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
              href
            )}`}
            width={16}
          />
          <div className="truncate text-primary text-sm">
            {domain.replace("www.", "")}
          </div>
        </div>
        <div className="line-clamp-2 font-medium text-sm">{title}</div>
        {!!description && (
          <div className="line-clamp-2 text-muted-foreground text-sm">
            {description}
          </div>
        )}
      </a>
    </HoverCardContent>
  );
}
