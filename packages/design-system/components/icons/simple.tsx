import type { SVGProps } from "react";
import type { SimpleIcon as SimpleIconData } from "simple-icons";

export type ProgrammingIcon = SimpleIconData;

export type SimpleIconProps = SVGProps<SVGSVGElement> & {
  icon: ProgrammingIcon;
};

/**
 * Renders canonical Simple Icons SVG data as a React SVG for brand-rich
 * programming and file icons.
 *
 * Callers pass a `simple-icons` export whose path follows the package's 24x24
 * viewBox contract. The component is decorative by default and becomes an image
 * only when the caller provides an `aria-label`.
 */
export function SimpleIcon({
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  children,
  fill = "currentColor",
  icon,
  role,
  viewBox = "0 0 24 24",
  ...props
}: SimpleIconProps) {
  const hasAccessibleName =
    typeof ariaLabel === "string" && ariaLabel.length > 0;

  return (
    <svg
      aria-hidden={ariaHidden ?? (hasAccessibleName ? undefined : true)}
      aria-label={ariaLabel}
      fill={fill}
      role={role ?? (hasAccessibleName ? "img" : undefined)}
      viewBox={viewBox}
      {...props}
    >
      {hasAccessibleName ? <title>{ariaLabel}</title> : null}
      <path d={icon.path} />
      {children}
    </svg>
  );
}
