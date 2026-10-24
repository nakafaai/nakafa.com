import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import {
  CardLink,
  CardLinks,
  CardRowText,
} from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import {
  AllExamsAction,
  HomeTile,
  RowText,
  TILE_ROWS,
} from "@/components/tenant/home/tile";
import { schoolExamEditTarget } from "@/lib/routing/school/target";

/** One draft of the viewer, as the school home holds it. */
type Draft = (typeof HomeView.Type)["drafts"][number];

/**
 * The exams the viewer started and may still edit, newest created first, each with its language. A row opens its
 * editor, and a draft the server is still saving shows its title without a link. A tile with more drafts than it
 * shows ends with All exams.
 */
export function DraftsTile({
  className,
  drafts,
  store,
}: {
  className?: string | undefined;
  drafts: readonly Draft[];
  store: StoreApi<ExamDrafts>;
}) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const locale = useLocale();
  const saving = useStore(store, (state) => state.ids);
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );

  return (
    <HomeTile
      action={
        drafts.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={t("tile-drafts-footer")}
      title={t("tile-drafts")}
    >
      <CardLinks>
        {Arr.map(Arr.take(drafts, TILE_ROWS), (draft) => (
          <DraftRow
            draft={draft}
            key={draft.id}
            names={names}
            saving={Arr.contains(saving, draft.id)}
          />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/**
 * One draft, as a row that opens its editor. A draft the server is still saving has a placeholder ID that no
 * editor can open, so its title shows without a link until the server answers.
 */
function DraftRow({
  draft,
  names,
  saving,
}: {
  draft: Draft;
  names: Intl.DisplayNames;
  saving: boolean;
}) {
  const tenant = useTenant();
  if (saving) {
    return (
      <CardRowText>
        <RowText detail={names.of(draft.language)} title={draft.title} />
      </CardRowText>
    );
  }
  return (
    <CardLink
      target={schoolExamEditTarget(tenant.slug, draft.id)}
      title={draft.title}
    >
      <RowText detail={names.of(draft.language)} title={draft.title} />
    </CardLink>
  );
}
