import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { useSittingStore } from "@/components/exams/sitting/context";
import { SittingFilter } from "@/components/exams/sitting/seat";
import { pageRowVariants } from "@/components/shared/content/width";

/**
 * The seats' filters, in the tab bar under the room's header: all students, the ones that need
 * attention, and the finished ones, each with its icon and always in view, so a proctor sees and
 * switches the view of a live sitting in one press.
 */
export function SittingFilterRow() {
  const t = useTranslations("Exams");
  const filter = useSittingStore((state) => state.filter);
  const chooseFilter = useSittingStore((state) => state.chooseFilter);

  return (
    <Tabs
      onValueChange={(value) =>
        Option.match(Schema.decodeUnknownOption(SittingFilter)(value), {
          onNone: () => undefined,
          onSome: chooseFilter,
        })
      }
      value={filter}
    >
      <TabsList aria-label={t("filter-label")} className={pageRowVariants()}>
        <TabsTab value="all">
          <HugeIcons aria-hidden="true" icon={UserGroupIcon} />
          {t("filter-all")}
        </TabsTab>
        <TabsTab value="needsAttention">
          <HugeIcons aria-hidden="true" icon={Alert02Icon} />
          {t("filter-needs-attention")}
        </TabsTab>
        <TabsTab value="finished">
          <HugeIcons aria-hidden="true" icon={CheckmarkCircle02Icon} />
          {t("filter-finished")}
        </TabsTab>
      </TabsList>
    </Tabs>
  );
}
