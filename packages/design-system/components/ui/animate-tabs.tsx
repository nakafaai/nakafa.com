"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import {
  type ComponentType,
  type SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface Props {
  tabs: {
    label: string;
    href: string;
    icon?: ComponentType<SVGProps<SVGSVGElement>>;
  }[];
  id?: string;
  className?: string;
}

export function AnimateTabs({ id, tabs, className }: Props) {
  const pathname = usePathname();
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverStyle, setHoverStyle] = useState({});
  const [activeStyle, setActiveStyle] = useState({ left: "0px", width: "0px" });

  // Helper function to process tab URLs
  const processTabUrl = useCallback(
    (href: string, removeQuery = false) => {
      const processedHref =
        href.includes("[id]") && id ? href.replace("[id]", id) : href;
      return removeQuery ? processedHref.split("?")[0] : processedHref;
    },
    [id]
  );

  // Find active tab index
  const activeIndex = useMemo(
    () => tabs.findIndex((tab) => pathname === processTabUrl(tab.href, true)),
    [pathname, tabs, processTabUrl]
  );

  // Update hover position when hovering a tab
  useEffect(() => {
    if (hoveredIndex !== null) {
      const hoveredElement = tabRefs.current[hoveredIndex];
      if (hoveredElement) {
        const { offsetLeft, offsetWidth } = hoveredElement;
        setHoverStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    }
  }, [hoveredIndex]);

  // Update active indicator position
  useEffect(() => {
    if (activeIndex >= 0) {
      const activeElement = tabRefs.current[activeIndex];
      if (activeElement) {
        const { offsetLeft, offsetWidth } = activeElement;
        setActiveStyle({
          left: `${offsetLeft}px`,
          width: `${offsetWidth}px`,
        });
      }
    }
  }, [activeIndex]);

  // Initialize active indicator position
  useEffect(() => {
    requestAnimationFrame(() => {
      if (activeIndex >= 0) {
        const activeElement = tabRefs.current[activeIndex];
        if (activeElement) {
          const { offsetLeft, offsetWidth } = activeElement;
          setActiveStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          });
        }
      }
    });
  }, [activeIndex]);

  return (
    <div className="grid">
      <nav
        className={cn(
          "scrollbar-hide relative mx-auto flex w-full max-w-4xl items-center overflow-x-auto",
          className
        )}
      >
        {/* Hover Highlight */}
        <div
          className="absolute flex h-[32px] items-center rounded-md bg-accent transition-all duration-300 ease-out"
          style={{
            ...hoverStyle,
            opacity: hoveredIndex !== null ? 1 : 0,
          }}
        />

        {/* Active Indicator */}
        <div
          className="absolute bottom-0 left-0 h-0.5 transition-all duration-300 ease-out"
          style={{
            ...activeStyle,
            backgroundColor: "var(--foreground)",
          }}
        />

        {/* Tabs */}
        {tabs.map((tab, index) => {
          const isActive = pathname === processTabUrl(tab.href, true);
          const Icon = tab.icon;

          return (
            <Link
              className={cn(
                "relative flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ease-out hover:text-accent-foreground",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
              href={processTabUrl(tab.href)}
              key={tab.href}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              prefetch={true}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
            >
              {!!Icon && <Icon className="size-4 shrink-0" />}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
