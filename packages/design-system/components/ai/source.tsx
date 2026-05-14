"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { createContext, useContext, useState } from "react";

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
 * Google Search grounding can return Vertex redirect URLs. When the grounded
 * source title is a domain, use that domain for the favicon instead.
 */
function getFaviconUrl({
  href,
  domain,
  label,
}: {
  href: string;
  domain: string;
  label?: string | number;
}) {
  const sourceHref = getFaviconSourceHref({ href, domain, label });

  if (!sourceHref) {
    return null;
  }

  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
    sourceHref
  )}`;
}

/** Selects the URL used for favicon lookup without leaking redirect hosts. */
function getFaviconSourceHref({
  href,
  domain,
  label,
}: {
  href: string;
  domain: string;
  label?: string | number;
}) {
  if (domain !== "vertexaisearch.cloud.google.com") {
    return href;
  }

  if (typeof label !== "string") {
    return null;
  }

  const sourceDomain = label.trim();

  if (
    !sourceDomain ||
    sourceDomain.includes("/") ||
    sourceDomain.includes(" ")
  ) {
    return null;
  }

  const sourceHref = `https://${sourceDomain}`;

  if (typeof URL.canParse === "function" && URL.canParse(sourceHref)) {
    return sourceHref;
  }

  return null;
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
  faviconUrl?: string;
  label?: string | number;
  showFavicon?: boolean;
}

export function SourceTrigger({
  faviconUrl,
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain } = useSourceContext();
  const [failedFaviconUrl, setFailedFaviconUrl] = useState("");
  const labelToShow = label ?? domain.replace("www.", "");
  const sourceFaviconUrl =
    getCustomFaviconUrl(faviconUrl) ?? getFaviconUrl({ href, domain, label });
  const visibleFaviconUrl =
    showFavicon && sourceFaviconUrl !== failedFaviconUrl
      ? sourceFaviconUrl
      : null;

  return (
    <HoverCardTrigger asChild>
      <a
        className={cn(
          "inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full border border-transparent bg-muted py-0 text-muted-foreground text-xs leading-none no-underline transition-colors ease-out hover:border-primary hover:bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] hover:text-primary",
          visibleFaviconUrl ? "pr-2 pl-1" : "px-1",
          className
        )}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {visibleFaviconUrl ? (
          <SourceFavicon
            alt="favicon"
            className="size-3.5 rounded-full"
            height={14}
            onUnavailable={() => setFailedFaviconUrl(visibleFaviconUrl)}
            src={visibleFaviconUrl}
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
  faviconUrl?: string;
  title: string;
}

export function SourceContent({
  title,
  description,
  faviconUrl,
  className,
}: SourceContentProps) {
  const { href, domain } = useSourceContext();
  const sourceFaviconUrl =
    getCustomFaviconUrl(faviconUrl) ??
    getFaviconUrl({ href, domain, label: title });
  const domainLabel = getDomainLabel({ domain, title });
  const cleanTitle = title.trim();
  const shouldShowTitle = cleanTitle && cleanTitle !== domainLabel;

  return (
    <HoverCardContent className={cn("w-80 p-0 shadow-xs", className)}>
      <a
        className="flex flex-col gap-2 p-3"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex items-center gap-1.5">
          {sourceFaviconUrl ? (
            <SourceFavicon
              alt="favicon"
              className="size-4 rounded-full"
              height={16}
              src={sourceFaviconUrl}
              width={16}
            />
          ) : null}
          <div className="truncate text-primary text-sm">{domainLabel}</div>
        </div>
        {shouldShowTitle ? (
          <div className="line-clamp-2 font-medium text-sm">{cleanTitle}</div>
        ) : null}
        {!!description && (
          <div className="line-clamp-2 text-muted-foreground text-sm">
            {description}
          </div>
        )}
      </a>
    </HoverCardContent>
  );
}

/** Uses provider favicon metadata only when it is already a valid URL. */
function getCustomFaviconUrl(faviconUrl?: string) {
  const value = faviconUrl?.trim();

  if (!value) {
    return null;
  }

  if (typeof URL.canParse === "function" && URL.canParse(value)) {
    return value;
  }

  return null;
}

interface SourceFaviconProps {
  alt: string;
  className?: string;
  height: number;
  onUnavailable?: () => void;
  src: string;
  width: number;
}

function SourceFavicon({
  alt,
  className,
  height,
  onUnavailable,
  src,
  width,
}: SourceFaviconProps) {
  const [failedSrc, setFailedSrc] = useState("");

  if (failedSrc === src) {
    return null;
  }

  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      onError={() => {
        setFailedSrc(src);
        onUnavailable?.();
      }}
      src={src}
      unoptimized
      width={width}
    />
  );
}
