import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { getTileLooks } from "@repo/design-system/lib/look";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Tuple } from "effect";
import { useTranslations } from "use-intl";
import { TryoutList } from "@/components/tryout/catalog/list";

const setRoute = getRouteApi(
  "/$locale/_main/try-out/$country/$exam/$group/$track/$set/"
);

/** The DOM id of the heading that names the other sets. */
const SIBLINGS_TITLE = "tryout-siblings";

/**
 * The other sets of the set's track, in the track's order, each a row that opens its page. The build
 * prerenders them with the page, so a reader goes on to the next set and a crawler reaches every set of
 * the track from any one of them.
 */
export function TryoutSetSiblings() {
  const t = useTranslations("Tryouts");
  const siblings = setRoute.useLoaderData({
    select: (route) => route.siblings,
  });
  if (siblings.length === 0) {
    return null;
  }
  const looks = getTileLooks(
    Arr.map(siblings, (set) => Tuple.make(SPARE_ICONS, set.setKey))
  );

  return (
    <nav aria-labelledby={SIBLINGS_TITLE} className="space-y-3">
      <h2 className="text-lg font-medium" id={SIBLINGS_TITLE}>
        {t("siblings-title")}
      </h2>
      <TryoutList
        emptyLabel={t("list-empty")}
        rows={Arr.zipWith(siblings, looks, (set, look) => ({
          address: { publicPath: set.publicPath },
          description: t("set-duration-minutes", {
            minutes: set.durationSeconds / 60,
          }),
          key: set.setKey,
          title: set.title,
          visual: look,
        }))}
      />
    </nav>
  );
}
