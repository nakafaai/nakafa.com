import type { Ref } from "@confect/core";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Card } from "@repo/design-system/components/ui/card";
import type { TileLook } from "@repo/design-system/lib/look";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MaterialRow } from "@/components/home/material";

/** How many lessons the home offers to pick up again. */
const SHOWN = 3;

/**
 * Continue learning (the owner's home sketch, 13 Nov): the lessons the
 * learner opened last, each ready to pick up again, or a line saying where
 * they will show.
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
  const rows = Arr.take(Arr.zip(recent, looks), SHOWN);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{t("continue")}</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("continue-empty")}</p>
      ) : (
        <Card className="gap-0 divide-y py-0" size="sm">
          {Arr.map(rows, ([material, look]) => (
            <MaterialRow
              key={material.content_id}
              look={look}
              material={material}
            />
          ))}
        </Card>
      )}
    </section>
  );
}
