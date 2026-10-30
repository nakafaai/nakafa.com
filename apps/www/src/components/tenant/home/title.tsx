import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";

/**
 * The greeting of the school home, which is the heading of its header row: the part of the day and the viewer's first
 * name, as plain text beside the sidebar's trigger. On a narrow phone it wraps to a second balanced line rather than
 * clip the name. The school layout's gate computes the greeting, so the name draws with the first frame.
 */
export function HomeGreeting() {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <h1 className="wrap-anywhere min-w-0 text-balance font-medium text-base">
      {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
    </h1>
  );
}
