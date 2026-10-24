import { Nina } from "@repo/design-system/components/ui/nina";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { DAY_PART_ACT } from "@/components/tenant/home/greeting";

/**
 * The page header row of the school home: the greeting as the page's title, with Nina beside it, and the page's one
 * action at its end. The school layout computes the greeting on the server, so the name and Nina's act are in the
 * first HTML, and the row keeps its height whether or not the action is there.
 */
export function HomeTitle({ action }: { action?: ReactNode }) {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <div className="flex min-h-10 items-center gap-3">
      <Nina act={DAY_PART_ACT[greeting.part]} label="" size={40} whole />
      <h2 className="min-w-0 font-medium text-2xl">
        {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
      </h2>
      {action === undefined ? null : (
        <div className="ms-auto flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}
