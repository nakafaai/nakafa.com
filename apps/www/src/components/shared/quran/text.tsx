import arabic from "@fontsource/amiri/files/amiri-arabic-400-normal.woff2";
import latin from "@fontsource/amiri/files/amiri-latin-400-normal.woff2";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { preload } from "react-dom";

/**
 * Preloads the Quran typeface while the server renders a page that draws Quran
 * text, so only those pages load it early: the Arabic subset for the words and
 * the Latin subset for the spaces between them. Only the server render preloads,
 * because Chromium never matches a font preload inserted by script with the
 * stylesheet's font request, as the math faces do (MathFontPreload).
 */
function QuranFontPreload() {
  if (typeof window === "undefined") {
    for (const file of [arabic, latin]) {
      preload(file, {
        as: "font",
        crossOrigin: "anonymous",
        type: "font/woff2",
      });
    }
  }
  return null;
}

export function QuranText({
  children,
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <>
      <QuranFontPreload />
      <p
        className={cn("font-quran text-4xl leading-loose", className)}
        dir="rtl"
        lang="ar"
        {...props}
      >
        {children}
      </p>
    </>
  );
}
