import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import anyAscii from "any-ascii";
import type { CSSProperties, ReactNode } from "react";

export interface OgImageProps {
  description?: ReactNode;
  icon?: ReactNode;
  primaryColor?: string;
  primaryTextColor?: string;
  site?: ReactNode;
  title: ReactNode;
}

const lightThemeColors = THEME_COMPATIBILITY_COLORS.light;
const foregroundColor = lightThemeColors.foreground;

const ogShellStyle = {
  width: "100%",
  height: "100%",
  backgroundColor: lightThemeColors.background,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: foregroundColor,
} satisfies CSSProperties;

const ogInnerStyle = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  padding: "60px",
  position: "relative",
  justifyContent: "space-between",
} satisfies CSSProperties;

const ogTextStackStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  marginBottom: "40px",
  textWrap: "pretty",
} satisfies CSSProperties;

const ogTitleStyle = {
  fontSize: 72,
  fontWeight: 600,
  lineHeight: 1.1,
  letterSpacing: 0,
  color: foregroundColor,
  lineClamp: 3,
  textOverflow: "ellipsis",
  overflow: "hidden",
} satisfies CSSProperties;

const ogDescriptionStyle = {
  fontSize: 36,
  color: foregroundColor,
  opacity: 0.8,
  fontWeight: 400,
  lineHeight: 1.4,
  maxWidth: "95%",
  letterSpacing: 0,
  lineClamp: 2,
  textOverflow: "ellipsis",
  overflow: "hidden",
} satisfies CSSProperties;

const ogFooterStyle = {
  display: "flex",
  alignItems: "center",
  gap: "28px",
} satisfies CSSProperties;

const ogSiteStyle = {
  fontSize: 32,
  fontWeight: 600,
  letterSpacing: 0,
  color: foregroundColor,
  opacity: 0.9,
} satisfies CSSProperties;

const ogSpacerStyle = { flexGrow: 1 } satisfies CSSProperties;

const ogAccentLineStyle = {
  height: 4,
  width: 60,
  borderRadius: 2,
} satisfies CSSProperties;

const ogCopyrightStyle = {
  fontSize: 22,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
  opacity: 0.8,
} satisfies CSSProperties;

/** Renders the shared Open Graph image layout from already-resolved content. */
export function OgImage({
  title,
  description,
  icon,
  primaryColor = lightThemeColors.secondary,
  primaryTextColor = lightThemeColors.primary,
  site = "Nakafa",
}: OgImageProps) {
  const sanitizedTitle = anyAscii(String(title));
  const sanitizedDescription = description
    ? anyAscii(String(description))
    : undefined;

  return (
    <div
      style={{
        ...ogShellStyle,
        backgroundImage: `linear-gradient(to bottom right, ${primaryColor}, transparent)`,
      }}
    >
      <div style={ogInnerStyle}>
        <div style={ogTextStackStyle}>
          <span style={ogTitleStyle}>{sanitizedTitle}</span>
          {!!sanitizedDescription && (
            <span style={ogDescriptionStyle}>{sanitizedDescription}</span>
          )}
        </div>

        <div style={ogFooterStyle}>
          {icon}
          <span style={ogSiteStyle}>{site}</span>
          <div style={ogSpacerStyle} />
          <div
            style={{
              ...ogAccentLineStyle,
              backgroundColor: primaryColor,
            }}
          />
          <span
            style={{
              ...ogCopyrightStyle,
              color: primaryTextColor,
            }}
          >
            Copyright Nakafa
          </span>
        </div>
      </div>
    </div>
  );
}
