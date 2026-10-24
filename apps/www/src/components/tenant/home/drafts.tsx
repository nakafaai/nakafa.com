import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { useLocale, useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import type { CellSpan } from "@/components/tenant/home/cells";
import { formatAge } from "@/lib/i18n/date";
import { SchoolHrefLink } from "@/lib/routing/school/link";

/** One draft of the viewer, as the school home holds it. */
type Draft = (typeof HomeView.Type)["drafts"][number];

/**
 * The exams the viewer started and may still edit, newest created first, each with its language and the time since
 * it was created. A row opens its editor, and a draft the server is still saving shows its title without a link.
 */
export function DraftsCell({
  drafts,
  now,
  span,
  store,
}: {
  drafts: readonly Draft[];
  now: number;
  span: CellSpan;
  store: StoreApi<ExamDrafts>;
}) {
  const t = useTranslations("School");
  const locale = useLocale();
  const saving = useStore(store, (state) => state.ids);
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-drafts")} />
      <Dashboard.List>
        {Arr.map(drafts, (draft) => (
          <DraftRow
            draft={draft}
            key={draft.id}
            locale={locale}
            names={names}
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
  names,
  now,
  saving,
}: {
  draft: Draft;
  locale: string;
  names: Intl.DisplayNames;
  now: number;
  saving: boolean;
}) {
  return (
    <Dashboard.Row
      detail={names.of(draft.language)}
      render={
        saving ? undefined : (
          <SchoolHrefLink
            href={`/exams/${draft.id}/edit`}
            title={draft.title}
          />
        )
      }
      title={draft.title}
      trailing={
        <span className="shrink-0 text-muted-foreground text-sm">
          {formatAge(draft.createdAt, locale, now)}
        </span>
      }
    />
  );
}
