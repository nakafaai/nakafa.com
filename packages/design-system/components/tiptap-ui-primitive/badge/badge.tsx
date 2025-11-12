"use client";

import type React from "react";
import "@repo/design-system/components/tiptap-ui-primitive/badge/badge-colors.scss";
import "@repo/design-system/components/tiptap-ui-primitive/badge/badge-group.scss";
import "@repo/design-system/components/tiptap-ui-primitive/badge/badge.scss";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "ghost" | "white" | "gray" | "green" | "default";
  size?: "default" | "small";
  appearance?: "default" | "subdued" | "emphasized";
  trimText?: boolean;
}

export const Badge = ({
  variant,
  size = "default",
  appearance = "default",
  trimText = false,
  className,
  children,
  ref,
  ...props
}: BadgeProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    className={`tiptap-badge ${className || ""}`}
    data-appearance={appearance}
    data-size={size}
    data-style={variant}
    data-text-trim={trimText ? "on" : "off"}
    ref={ref}
    {...props}
  >
    {children}
  </div>
);

export default Badge;
