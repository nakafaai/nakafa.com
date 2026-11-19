import type { Ref } from "@confect/core";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MaterialRow } from "@/components/home/material";
import { HomeRowText, SectionDoor, SectionMore } from "@/components/home/row";
import { HomeSection } from "@/components/home/section";
import { getPrimaryNavigationItems } from "@/components/sidebar/data/navigation";

/** How many lessons the home offers to pick up again. */
const SHOWN = 3;

/** The sidebar's Subjects entry, which this section leads to. */
const [SUBJECTS] = getPrimaryNavigationItems();

/**
 * The home's third section (the owner's home notes, 14 Nov): the lessons the
 * learner opened last, each ready to pick up again, under the sidebar's own
 * name for them. A learner who has opened none gets one row that leads to the
 * subjects in their place.
 */
export function HomeContinue({
  looks,
  recent,
}: {
  looks: readonly TileLook[];
  recent: readonly Ref.Returns<
    typeof contents.queries.recent.getRecentlyViewed
  >[number][];
}) {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const rows = Arr.take(Arr.zip(recent, looks), SHOWN);
  return (
    <HomeSection
      action={<SectionMore item={SUBJECTS} />}
      title={tCommon("subject")}
    >
      {rows.length === 0 ? (
        <SectionDoor item={SUBJECTS}>
          <HomeRowText
            description={t("subjects-first")}
            title={tCommon("subject")}
          />
        </SectionDoor>
      ) : (
        Arr.map(rows, ([material, look]) => (
          <MaterialRow
            key={material.content_id}
            look={look}
            material={material}
          />
        ))
      )}
    </HomeSection>
  );
}
