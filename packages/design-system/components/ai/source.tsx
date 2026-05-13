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

/**
 * Derive the readable domain label shown for one source link.
 *
 * `URL.canParse()` lets us validate the input without a `try`/`catch`, and it
 * returns the same success/failure result as constructing `new URL(...)`.
 *
 * Related docs:
 * https://developer.mozilla.org/en-US/docs/Web/API/URL/canParse_static
 */
function getSourceDomain(href: string) {
  if (typeof URL.canParse === "function" && URL.canParse(href)) {
    return new URL(href).hostname;
  }

  return href.split("/").pop() || href;
}

/**
 * Google Search grounding sources may use redirect URLs that do not expose a
 * stable favicon. Rendering those through Next Image produces noisy 404 logs.
 */
function getFaviconUrl(href: string, domain: string) {
  if (domain === "vertexaisearch.cloud.google.com") {
    return null;
  }

  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
    href
  )}`;
}

/**
 * Uses the grounded page title when Google returns a Vertex redirect domain.
 */
function getDomainLabel({ domain, title }: { domain: string; title: string }) {
  if (domain === "vertexaisearch.cloud.google.com" && title.trim()) {
    return title.trim();
  }

  return domain.replace("www.", "");
}

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
  const domain = getSourceDomain(href);

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
  const faviconUrl = getFaviconUrl(href, domain);

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
        {showFavicon && faviconUrl ? (
          <Image
            alt="favicon"
            className="size-3.5 rounded-full"
            fetchPriority="high"
            height={14}
            loading="eager"
            preload
            src={faviconUrl}
            width={14}
          />
        ) : null}
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
  const faviconUrl = getFaviconUrl(href, domain);
  const domainLabel = getDomainLabel({ domain, title });

  return (
    <HoverCardContent className={cn("w-80 p-0 shadow-xs", className)}>
      <a
        className="flex flex-col gap-2 p-3"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-center gap-1.5">
          {faviconUrl ? (
            <Image
              alt="favicon"
              className="size-4 rounded-full"
              height={16}
              src={faviconUrl}
              width={16}
            />
          ) : null}
          <div className="truncate text-primary text-sm">{domainLabel}</div>
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
