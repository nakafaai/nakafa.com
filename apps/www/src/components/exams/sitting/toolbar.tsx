import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Schema } from "effect";
import { useTranslations } from "use-intl";
import { useSittingStore } from "@/components/exams/sitting/context";
import { SittingFilter } from "@/components/exams/sitting/seat";

/** The filter row of the seats: all students, the ones that need attention, and the finished ones. */
export function SittingToolbar() {
  const t = useTranslations("Exams");
  const filter = useSittingStore((state) => state.filter);
  const chooseFilter = useSittingStore((state) => state.chooseFilter);

  return (
    <ToggleGroup
      aria-label={t("filter-label")}
      gridColumns="3"
      onValueChange={(next) => {
        if (Schema.is(SittingFilter)(next)) {
          chooseFilter(next);
        }
      }}
      value={filter}
      variant="outline"
    >
      <ToggleGroupItem value="all">{t("filter-all")}</ToggleGroupItem>
      <ToggleGroupItem value="needsAttention">
        {t("filter-needs-attention")}
      </ToggleGroupItem>
      <ToggleGroupItem value="finished">{t("filter-finished")}</ToggleGroupItem>
    </ToggleGroup>
  );
}
