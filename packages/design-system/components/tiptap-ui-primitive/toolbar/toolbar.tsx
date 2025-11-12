"use client";

import { Separator } from "@repo/design-system/components/tiptap-ui-primitive/separator";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import "@repo/design-system/components/tiptap-ui-primitive/toolbar/toolbar.scss";
import { useComposedRef } from "@repo/design-system/hooks/use-composed-ref";
import { useMenuNavigation } from "@repo/design-system/hooks/use-menu-navigation";
import { cn } from "@repo/design-system/lib/tiptap-utils";

type BaseProps = React.HTMLAttributes<HTMLDivElement>;

interface ToolbarProps extends BaseProps {
  variant?: "floating" | "fixed";
}

const useToolbarNavigation = (
  toolbarRef: React.RefObject<HTMLDivElement | null>
) => {
  const [items, setItems] = useState<HTMLElement[]>([]);

  const collectItems = useCallback(() => {
    if (!toolbarRef.current) {
      return [];
    }
    return Array.from(
      toolbarRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [role="button"]:not([disabled]), [tabindex="0"]:not([disabled])'
      )
    );
  }, [toolbarRef]);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }

    const updateItems = () => setItems(collectItems());

    updateItems();
    const observer = new MutationObserver(updateItems);
    observer.observe(toolbar, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [collectItems, toolbarRef]);

  const { selectedIndex } = useMenuNavigation<HTMLElement>({
    containerRef: toolbarRef,
    items,
    orientation: "horizontal",
    onSelect: (el) => el.click(),
    autoSelectFirstItem: false,
  });

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (toolbar.contains(target)) {
        target.setAttribute("data-focus-visible", "true");
      }
    };

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (toolbar.contains(target)) {
        target.removeAttribute("data-focus-visible");
      }
    };

    toolbar.addEventListener("focus", handleFocus, true);
    toolbar.addEventListener("blur", handleBlur, true);

    return () => {
      toolbar.removeEventListener("focus", handleFocus, true);
      toolbar.removeEventListener("blur", handleBlur, true);
    };
  }, [toolbarRef]);

  useEffect(() => {
    if (selectedIndex !== undefined && items[selectedIndex]) {
      items[selectedIndex].focus();
    }
  }, [selectedIndex, items]);
};

export const Toolbar = ({
  children,
  className,
  variant = "fixed",
  ref,
  ...props
}: ToolbarProps & { ref?: React.Ref<HTMLDivElement> }) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRef(toolbarRef, ref);
  useToolbarNavigation(toolbarRef);

  return (
    <div
      aria-label="toolbar"
      className={cn("tiptap-toolbar", className)}
      data-variant={variant}
      ref={composedRef}
      role="toolbar"
      {...props}
    >
      {children}
    </div>
  );
};

export const ToolbarGroup = ({
  children,
  className,
  ref,
  ...props
}: React.ComponentProps<"fieldset"> & {
  ref?: React.Ref<HTMLFieldSetElement>;
}) => (
  <fieldset
    className={cn("tiptap-toolbar-group", className)}
    ref={ref}
    {...props}
  >
    {children}
  </fieldset>
);

export const ToolbarSeparator = ({
  ref,
  ...props
}: BaseProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <Separator decorative orientation="vertical" ref={ref} {...props} />
);
