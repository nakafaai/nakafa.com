import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { useTranslations } from "use-intl";
import { useSittingStore } from "@/components/exams/sitting/context";
import { TableChoice } from "@/components/shared/table/toolbar";

/**
 * The seats' Filter menu, in the room's header row: all students, the ones that need
 * attention, and the finished ones, each with its icon.
 */
export function SittingFilterMenu() {
  const t = useTranslations("Exams");
  const filter = useSittingStore((state) => state.filter);
  const chooseFilter = useSittingStore((state) => state.chooseFilter);

  return (
    <TableChoice
      onChange={chooseFilter}
      options={[
        { icon: UserGroupIcon, label: t("filter-all"), value: "all" },
        {
          icon: Alert02Icon,
          label: t("filter-needs-attention"),
          value: "needsAttention",
        },
        {
          icon: CheckmarkCircle02Icon,
          label: t("filter-finished"),
          value: "finished",
        },
      ]}
      title={t("filter-label")}
      value={filter}
    />
  );
}
