"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { cn } from "@repo/design-system/lib/utils";
import Image from "next/image";
import { createContext, use, useMemo, useState } from "react";

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

function getFaviconUrl({ href }: { href: string }) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
    href
  )}`;
}

function getDomainLabel(domain: string) {
  return domain.replace("www.", "");
}

/** Reads source link data from the nearest Source provider. */
function useSourceContext() {
  const ctx = use(SourceContext);
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
  const contextValue = useMemo(() => ({ href, domain }), [href, domain]);

  return (
    <SourceContext.Provider value={contextValue}>
      <HoverCard>{children}</HoverCard>
    </SourceContext.Provider>
  );
}

export interface SourceTriggerProps {
  className?: string;
  faviconUrl?: string;
  label?: React.ReactNode;
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
    getCustomFaviconUrl(faviconUrl) ?? getFaviconUrl({ href });
  const visibleFaviconUrl =
    showFavicon && sourceFaviconUrl !== failedFaviconUrl
      ? sourceFaviconUrl
      : null;

  return (
    <HoverCardTrigger
      className={cn(
        "inline-flex h-5 max-w-32 items-center gap-1 overflow-hidden rounded-full border border-transparent bg-muted py-0 text-muted-foreground text-xs leading-none no-underline transition-colors ease-out hover:border-primary hover:bg-[color-mix(in_oklch,var(--primary)_5%,var(--background))] hover:text-foreground",
        visibleFaviconUrl ? "pr-2 pl-1" : "px-1",
        className
      )}
      closeDelay={0}
      delay={150}
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
    getCustomFaviconUrl(faviconUrl) ?? getFaviconUrl({ href });
  const domainLabel = getDomainLabel(domain);
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
