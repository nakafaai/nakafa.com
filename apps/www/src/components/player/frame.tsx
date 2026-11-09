import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  pageBoxVariants,
  pageGutterVariants,
  readingMeasureVariants,
} from "@/components/shared/content/width";
import { PaneSide } from "@/components/shared/panes/side";

/**
 * The questions in the page's frame, right under the player's one header row, and the navigator in the pane at the
 * screen's right from the window's top to its bottom, as every pane of Nakafa stands. The page itself scrolls, as the
 * questions' reading line and their reveal expect, and the questions keep a readable measure. Below the large
 * breakpoint the pane steps aside and the navigator opens as a sheet.
 */
export function PlayerMain({
  children,
  label,
  navigator,
}: {
  children: ReactNode;
  /** The pane's name for a screen reader, the navigator's unless the paper names its pane otherwise. */
  label?: string;
  navigator: ReactNode;
}) {
  const t = useTranslations("Player");

  return (
    <div className={cn(pageBoxVariants(), "flex-1")}>
      <div
        className={cn(
          readingMeasureVariants(),
          pageGutterVariants(),
          "min-w-0 py-6"
        )}
      >
        {children}
      </div>
      {navigator === null ? null : (
        <PaneSide
          from="lg"
          group="player"
          label={label ?? t("navigator")}
          row={false}
        >
          {navigator}
        </PaneSide>
      )}
    </div>
  );
}
