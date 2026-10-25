import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { DAY_PART_EDGE } from "@/components/tenant/home/greeting";

/**
 * The greeting of the school home, which is the heading of its header row, with Nina beside it rising from the
 * header's bottom edge, half of her seen, doing what fits the part of the day. She stands on the edge at 48 pixels, so
 * she reads at the size of the row rather than as a small icon. The school layout computes the greeting on the server,
 * so the name and Nina are in the first HTML.
 */
export function HomeGreeting() {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <div className="flex min-w-0 items-center gap-3 self-stretch">
      <span className="flex shrink-0 self-end">
        <Nina act={DAY_PART_EDGE[greeting.part]} label="" size={48} />
      </span>
      <h1 className="min-w-0 truncate font-medium text-base">
        {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
      </h1>
    </div>
  );
}
