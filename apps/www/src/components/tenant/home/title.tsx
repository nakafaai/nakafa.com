import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { DAY_PART_ACT } from "@/components/tenant/home/greeting";

/**
 * The greeting of the school home, which is the heading of its header row, with Nina's act for the part of the day
 * beside it. The school layout computes the greeting on the server, so the name and Nina's act are in the first HTML.
 */
export function HomeGreeting() {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Nina act={DAY_PART_ACT[greeting.part]} label="" size={32} whole />
      <h1 className="min-w-0 truncate font-medium text-base">
        {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
      </h1>
    </div>
  );
}
