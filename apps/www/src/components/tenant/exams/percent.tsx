import {
  ArrowExpandIcon,
  FitToScreenIcon,
  ZoomIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useExamZoom } from "@/components/tenant/exams/provider";
import {
  drawnZoom,
  type ExamZoom,
  ZOOM_PRESETS,
} from "@/components/tenant/exams/zoom";

/** The value of the percentage menu: a preset zoom, or `fit` and `fill`. */
const zoomChoice = (zoom: Pick<ExamZoom, "mode" | "percent">) =>
  zoom.mode === "percent" ? String(zoom.percent) : zoom.mode;

/**
 * The percentage of the zoom as a button that opens its menu, as a design tool's zoom options: the preset
 * zooms from the largest to the smallest, then Fit, which draws each page at its own width and is chosen
 * at first, and Fill, which stretches the pages across the canvas. The button names the zoom drawn now.
 */
export function ZoomMenu({
  onZoom,
}: {
  readonly onZoom: (percent: number) => void;
}) {
  const t = useTranslations("Exams");
  const drawn = useExamZoom(drawnZoom);
  const choice = useExamZoom(zoomChoice);
  const fit = useExamZoom((zoom) => zoom.fit);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("zoom-options")}
            className="w-16 justify-end tabular-nums"
            size="sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {drawn}%
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" side="top">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (value === "fit" || value === "fill") {
              fit(value);
              return;
            }
            onZoom(Number(value));
          }}
          value={choice}
        >
          <DropdownMenuGroup>
            {Arr.map(ZOOM_PRESETS, (preset) => (
              <DropdownMenuRadioItem
                className="cursor-pointer tabular-nums"
                key={preset}
                value={String(preset)}
              >
                <HugeIcons icon={ZoomIcon} />
                {preset}%
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuRadioItem className="cursor-pointer" value="fit">
              <HugeIcons icon={FitToScreenIcon} />
              {t("zoom-fit")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem className="cursor-pointer" value="fill">
              <HugeIcons icon={ArrowExpandIcon} />
              {t("zoom-fill")}
            </DropdownMenuRadioItem>
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
