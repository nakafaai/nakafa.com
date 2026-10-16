import { getTranslations } from "next-intl/server";
import { Missing } from "@/components/state/missing";
import { ActionNavigation } from "@/components/state/navigation";
import { Stage } from "@/components/state/stage";

/** Renders the localized state of a route that does not exist. */
export default async function NotFound() {
  const [t, tState] = await Promise.all([
    getTranslations("NotFound"),
    getTranslations("State"),
  ]);

  return (
    <Stage>
      <Missing description={t("description")} title={t("title")}>
        <ActionNavigation
          href="/"
          label={tState("home-button")}
          variant="default"
        />
        <ActionNavigation
          href="/search"
          label={t("search-button")}
          variant="ghost"
        />
      </Missing>
    </Stage>
  );
}
