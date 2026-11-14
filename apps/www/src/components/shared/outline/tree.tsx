"use client";

import type { ParsedHeading } from "@repo/contents/toc";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { SidebarMenuSub } from "@repo/design-system/components/ui/sidebar-submenu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { elementById } from "@repo/design-system/lib/element";
import { Array as Arr, Option } from "effect";
import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { useTranslations } from "use-intl";
import { TocProvider, useToc } from "@/components/shared/outline/context";
import { revealOffset } from "@/components/shared/outline/reading";

interface Props {
  data: ParsedHeading[];
  title?: string;
}

/** The element that scrolls an outline in its panel. */
const OUTLINE_SCROLLER = '[data-slot="scroll-area-viewport"]';

/** Keeps outline labels on one line while exposing their complete title. */
function SidebarTreeLabel({ label }: Pick<ParsedHeading, "label">) {
  return (
    <span className="truncate" title={label}>
      {label}
    </span>
  );
}

/** Renders one heading and its nested headings. */
function SidebarTreeItem({ heading }: { heading: ParsedHeading }) {
  return (
    <SidebarMenuItem>
      <SidebarTreeLink heading={heading} />
      {!!heading.children && heading.children.length > 0 && (
        <SidebarMenuSub>
          {Arr.map(heading.children, (child) => (
            <SidebarTreeItem heading={child} key={child.href} />
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

/** Shows a heading's complete label beside its outline entry. */
function SidebarTreeTooltip({
  children,
  label,
}: {
  children: ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        align="center"
        className="hidden max-w-xs sm:block"
        side="left"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Whether a heading's section is the one being read. Each entry selects only
 * its own state, so a change of section re-renders the two entries that change
 * instead of the whole outline. The entry's link names the heading's id.
 */
function useActiveHeading({ href }: Pick<ParsedHeading, "href">) {
  return useToc((context) => Option.contains(context.active, href.slice(1)));
}

/**
 * Scrolls the outline the least that shows a whole entry, and never the page, so
 * the section being read stays in sight in an outline longer than its panel.
 */
function revealEntry(entry: HTMLElement) {
  const scroller = entry.closest(OUTLINE_SCROLLER);
  if (scroller === null) {
    return;
  }
  scroller.scrollTop += revealOffset(
    entry.getBoundingClientRect(),
    scroller.getBoundingClientRect()
  );
}

/**
 * Jumps to a heading of the page on screen, which stays the same page. The
 * jump writes a history entry that carries the router's own state, copied from
 * the entry the reader leaves, so Back and Forward restore this page through the
 * router. A plain fragment entry carries no router state, and the router ignores
 * it on Back, which left the page the reader had moved away from on screen.
 * A modified click keeps the browser's own handling, such as a new tab.
 */
function jumpToHeading(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  const link = event.currentTarget;
  // A fragment the page is already on replaces its entry, as the browser does.
  if (link.href === window.location.href) {
    window.history.replaceState(window.history.state, "", link.href);
  } else {
    window.history.pushState(window.history.state, "", link.href);
  }
  elementById(decodeURIComponent(link.hash.slice(1)))?.scrollIntoView();
}

/**
 * Links a heading in the document. The anchor keeps the heading's href, so the
 * link works before the page hydrates; the page's own jump takes over after.
 */
function SidebarTreeLink({ heading }: { heading: ParsedHeading }) {
  const isActive = useActiveHeading(heading);
  const entry = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isActive && entry.current !== null) {
      revealEntry(entry.current);
    }
  }, [isActive]);

  return (
    <SidebarTreeTooltip label={heading.label}>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <a
            href={heading.href}
            onClick={jumpToHeading}
            ref={entry}
            title={heading.label}
          >
            <SidebarTreeLabel label={heading.label} />
          </a>
        }
      />
    </SidebarTreeTooltip>
  );
}

/** Frames an outline under its labeled group heading. */
function SidebarTreeGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarGroupContent>{children}</SidebarGroupContent>
    </SidebarGroup>
  );
}

/**
 * Lists links to the sections of the page, the section being read marked.
 * @param data - The headings, such as `contentOutline` gives for a signed content tree.
 */
export function SidebarTree({ data, title }: Props) {
  const t = useTranslations("Common");

  return (
    <SidebarTreeGroup title={title ?? t("on-this-page")}>
      <SidebarMenu>
        <TocProvider toc={data}>
          {Arr.map(data, (item) => (
            <SidebarTreeItem heading={item} key={item.href} />
          ))}
        </TocProvider>
      </SidebarMenu>
    </SidebarTreeGroup>
  );
}
