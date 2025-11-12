"use client";

// --- Tiptap UI Primitive ---
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/tiptap-ui-primitive/tooltip";
// --- Lib ---
import { cn, parseShortcutKeys } from "@repo/design-system/lib/tiptap-utils";
import type React from "react";
import { Fragment, useMemo } from "react";

import "@repo/design-system/components/tiptap-ui-primitive/button/button-colors.scss";
import "@repo/design-system/components/tiptap-ui-primitive/button/button-group.scss";
import "@repo/design-system/components/tiptap-ui-primitive/button/button.scss";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  showTooltip?: boolean;
  tooltip?: React.ReactNode;
  shortcutKeys?: string;
}

export const ShortcutDisplay: React.FC<{ shortcuts: string[] }> = ({
  shortcuts,
}) => {
  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <div>
      {shortcuts.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <kbd>+</kbd>}
          <kbd>{key}</kbd>
        </Fragment>
      ))}
    </div>
  );
};

export const Button = ({
  className,
  children,
  tooltip,
  showTooltip = true,
  shortcutKeys,
  "aria-label": ariaLabel,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const shortcuts = useMemo<string[]>(
    () => parseShortcutKeys({ shortcutKeys }),
    [shortcutKeys]
  );

  if (!(tooltip && showTooltip)) {
    return (
      <button
        aria-label={ariaLabel}
        className={cn("tiptap-button", className)}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <Tooltip delay={200}>
      <TooltipTrigger
        aria-label={ariaLabel}
        className={cn("tiptap-button", className)}
        ref={ref}
        {...props}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {tooltip}
        <ShortcutDisplay shortcuts={shortcuts} />
      </TooltipContent>
    </Tooltip>
  );
};

export const ButtonGroup = ({
  className,
  children,
  orientation = "vertical",
  ref,
  ...props
}: React.ComponentProps<"fieldset"> & {
  orientation?: "horizontal" | "vertical";
  ref?: React.Ref<HTMLFieldSetElement>;
}) => (
  <fieldset
    className={cn("tiptap-button-group", className)}
    data-orientation={orientation}
    ref={ref}
    {...props}
  >
    {children}
  </fieldset>
);

export default Button;
