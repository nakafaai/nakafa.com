import { getTranslations } from "next-intl/server";
import { Missing } from "@/components/state/missing";
import { ActionNavigation } from "@/components/state/navigation";
import { Stage } from "@/components/state/stage";

/**
 * Renders the state of a school or a class that cannot be found: School's own
 * words and way back, and the way home that every full-page state says the same.
 */
export default async function NotFound() {
  const [t, tState] = await Promise.all([
    getTranslations("School.Missing"),
    getTranslations("State"),
  ]);

  return (
    <Stage>
      <Missing description={t("description")} scene="school" title={t("title")}>
        <ActionNavigation
          href="/school"
          label={t("back-button")}
          variant="default"
        />
        <ActionNavigation
          href="/"
          label={tState("home-button")}
          variant="ghost"
        />
      </Missing>
    </Stage>
  );
}
