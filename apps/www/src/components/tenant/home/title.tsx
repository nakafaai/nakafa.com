import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";

/**
 * The greeting of the school home, which is the heading of its header row: the part of the day and the viewer's first
 * name, as plain text beside the sidebar's trigger, so the row stays one balanced line. The school layout computes the
 * greeting on the server, so the name is in the first HTML.
 */
export function HomeGreeting() {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <h1 className="min-w-0 truncate font-medium text-base">
      {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
    </h1>
  );
}
