"use client";

import { Globe02Icon } from "@hugeicons/core-free-icons";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";
import { Array as Arr, Option, Schema } from "effect";
import Image from "next/image";
import { createContext, use, useMemo, useState } from "react";

/** One cited link and the domain it is shown under. */
const SourceLinkSchema = Schema.Struct({
  domain: Schema.String,
  href: Schema.String,
});
type SourceLink = typeof SourceLinkSchema.Type;

const SourceContext = createContext<SourceLink | null>(null);

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

  return Option.getOrElse(Arr.last(href.split("/")), () => "") || href;
}

function getFaviconUrl({ href }: { href: string }) {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
    href
  )}`;
}

function getDomainLabel(domain: string) {
  return domain.replace("www.", "");
}

/** Selects one part of the nearest Source link. */
function useSource<T>(selector: (source: SourceLink) => T) {
  const value = use(SourceContext);
  if (!value) {
    throw new Error("Source.* must be used inside <Source>");
  }
  return selector(value);
}

interface SourceProps {
  children: React.ReactNode;
  href: string;
}

export function Source({ href, children }: SourceProps) {
  const domain = getSourceDomain(href);
  const source = useMemo(() => ({ domain, href }), [domain, href]);

  return (
    <SourceContext value={source}>
      <HoverCard>{children}</HoverCard>
    </SourceContext>
  );
}

interface SourceTriggerProps {
  className?: string;
  faviconUrl?: string | undefined;
  title?: string | undefined;
}

/**
 * One cited source as a row a learner can read without a pointer: its icon, its
 * title and the host it came from. The whole row is the link, and a pointer
 * also opens the card with the description of the page. A source with no title
 * shows its host in the title's place. A title shows two lines at most, by
 * decision: the rest is cut, and all of it stays in the name of the link. Two
 * titles on one host that share their first two lines look the same. The lines
 * of a title are 24 px high: the clip at two lines would cut the tone marks of
 * Thai, which stand about 16 px above the baseline at this size, out of a line
 * of 20 px.
 */
export function SourceTrigger({
  className,
  faviconUrl,
  title,
}: SourceTriggerProps) {
  const href = useSource((source) => source.href);
  const host = useSource((source) => getDomainLabel(source.domain));
  const cleanTitle = title?.trim() ?? "";
  const named = cleanTitle !== "" && cleanTitle !== host;

  return (
    <HoverCardTrigger
      className={cn(
        "group/source flex min-w-0 items-start gap-2 rounded-sm py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      closeDelay={0}
      delay={150}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <SourceIcon
        src={getCustomFaviconUrl(faviconUrl) ?? getFaviconUrl({ href })}
      />
      <span className="flex min-w-0 flex-col">
        <span
          className="wrap-anywhere line-clamp-2 text-sm leading-6 group-hover/source:underline group-focus-visible/source:underline"
          data-slot="source-title"
          dir="auto"
        >
          {named ? cleanTitle : host}
        </span>
        {named ? (
          <span
            className="wrap-anywhere text-muted-foreground text-xs"
            data-slot="source-host"
          >
            {host}
          </span>
        ) : null}
      </span>
    </HoverCardTrigger>
  );
}

interface SourceContentProps {
  className?: string;
  description?: string | undefined;
}

/**
 * The description of a source, which a pointer reads in a card. A source with
 * no description has no card.
 */
export function SourceContent({ className, description }: SourceContentProps) {
  const text = description?.trim();

  if (!text) {
    return null;
  }

  return (
    <HoverCardContent className={cn("w-80 p-3 shadow-xs", className)}>
      <p
        className="wrap-anywhere line-clamp-2 text-muted-foreground text-sm leading-6"
        dir="auto"
      >
        {text}
      </p>
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

/**
 * The icon of a source on a chip. An icon is another site's artwork, drawn for
 * a white page, so its chip is white in both themes: a black mark on a
 * transparent ground stays visible in the dark theme. An icon that does not
 * load leaves a chip with a globe, so the rows keep their alignment.
 */
function SourceIcon({ src }: { src: string }) {
  const [failedSrc, setFailedSrc] = useState("");
  const failed = failedSrc === src;

  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-border",
        failed ? "bg-muted text-muted-foreground" : "bg-white"
      )}
      data-slot="source-icon"
    >
      {failed ? (
        <HugeIcons className="size-3.5" icon={Globe02Icon} />
      ) : (
        <Image
          alt=""
          className="size-4"
          height={16}
          onError={() => setFailedSrc(src)}
          src={src}
          unoptimized
          width={16}
        />
      )}
    </span>
  );
}
