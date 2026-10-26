import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { useSittingStore } from "@/components/exams/sitting/context";
import { SittingFilter } from "@/components/exams/sitting/seat";

/**
 * The seats' filters, as the row under the room's header: all students, the ones that need
 * attention, and the finished ones, each with its icon and always in view, so a proctor sees and
 * switches the view of a live sitting in one press. Pressing the chosen filter again keeps it.
 */
export function SittingFilterRow() {
  const t = useTranslations("Exams");
  const filter = useSittingStore((state) => state.filter);
  const chooseFilter = useSittingStore((state) => state.chooseFilter);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6">
      <ToggleGroup
        aria-label={t("filter-label")}
        onValueChange={(value) =>
          Option.match(Schema.decodeUnknownOption(SittingFilter)(value), {
            onNone: () => undefined,
            onSome: chooseFilter,
          })
        }
        size="sm"
        value={filter}
        variant="outline"
      >
        <ToggleGroupItem value="all">
          <HugeIcons aria-hidden="true" icon={UserGroupIcon} />
          {t("filter-all")}
        </ToggleGroupItem>
        <ToggleGroupItem value="needsAttention">
          <HugeIcons aria-hidden="true" icon={Alert02Icon} />
          {t("filter-needs-attention")}
        </ToggleGroupItem>
        <ToggleGroupItem value="finished">
          <HugeIcons aria-hidden="true" icon={CheckmarkCircle02Icon} />
          {t("filter-finished")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
