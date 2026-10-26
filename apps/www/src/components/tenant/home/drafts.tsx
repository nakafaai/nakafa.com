import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import { useTenant } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import type { CellSpan } from "@/components/tenant/home/cells";
import { useHomeNow } from "@/components/tenant/home/clock";
import { formatAge } from "@/lib/i18n/date";
import { TargetLink } from "@/lib/routing/link";
import { schoolExamEditTarget } from "@/lib/routing/school/target";

/** One draft of the viewer, as the school home holds it. */
type Draft = (typeof HomeView.Type)["drafts"][number];

/**
 * The exams the viewer started and may still edit, newest created first, each with the time since it was created. A
 * row opens its editor, and a draft the server is still saving shows its title without a link.
 */
export function DraftsCell({
  drafts,
  span,
  store,
}: {
  drafts: readonly Draft[];
  span: CellSpan;
  store: StoreApi<ExamDrafts>;
}) {
  const t = useTranslations("School");
  const locale = useLocale();
  const now = useHomeNow();
  const saving = useStore(store, (state) => state.ids);

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-drafts")} />
      <Dashboard.List>
        {Arr.map(drafts, (draft) => (
          <DraftRow
            draft={draft}
            key={draft.id}
            locale={locale}
            now={now}
            saving={Arr.contains(saving, draft.id)}
          />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/**
 * One draft, as a row that opens its editor. A draft the server is still saving has a placeholder ID that no editor
 * can open, so its row shows without a link until the server answers.
 */
function DraftRow({
  draft,
  locale,
  now,
  saving,
}: {
  draft: Draft;
  locale: string;
  now: number;
  saving: boolean;
}) {
  const tenant = useTenant();
  const t = useTranslations("School");

  return (
    <Dashboard.Row
      render={
        saving ? undefined : (
          <TargetLink
            target={schoolExamEditTarget(tenant.slug, draft.id)}
            title={draft.title}
          />
        )
      }
      title={draft.title}
      trailing={t("draft-created", {
        age: formatAge(draft.createdAt, locale, now),
      })}
    />
  );
}
