"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useStore } from "zustand";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import {
  homeExamsRead,
  useHomeExams,
} from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/** One draft of the viewer, as the school home holds it. */
type Draft = (typeof HomeView.Type)["drafts"][number];

/**
 * The exams the viewer started and may still edit, newest created first, each with its language. A row
 * opens its editor, and a draft the server is still saving shows its title without a link. A failed
 * read shows its own sentence and Try again inside this tile.
 */
export function DraftsTile({
  className,
  drafts,
}: {
  className?: string | undefined;
  drafts: ExamDrafts;
}) {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <HomeTile
      className={className}
      hint={t("tile-drafts-footer")}
      title={t("tile-drafts")}
    >
      <ReadBoundary read={homeExamsRead(tenant.slug)}>
        <DraftRows drafts={drafts} />
      </ReadBoundary>
    </HomeTile>
  );
}

/** The drafts as rows, or the tile's empty state while the viewer has none. */
function DraftRows({ drafts: store }: { drafts: ExamDrafts }) {
  const t = useTranslations("School");
  const locale = useLocale();
  const exams = useHomeExams();
  const saving = useStore(store, (state) => state.ids);
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (!QueryResult.isSuccess(exams)) {
    return null;
  }
  const drafts = exams.value.drafts;
  if (Arr.isReadonlyArrayEmpty(drafts)) {
    return <TileEmpty act="writing">{t("tile-drafts-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(drafts, (draft) => (
        <DraftRow
          draft={draft}
          key={draft.id}
          names={names}
          saving={Arr.contains(saving, draft.id)}
        />
      ))}
    </CardLinks>
  );
}

/**
 * One draft, as a row that opens its editor. A draft the server is still saving has a placeholder
 * ID that no editor can open, so its title shows without a link until the server answers.
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
  if (saving) {
    return (
      <li className="px-6 py-3">
        <RowText detail={names.of(draft.language)} title={draft.title} />
      </li>
    );
  }
  return (
    <CardLink href={`/exams/${draft.id}/edit`} title={draft.title}>
      <RowText detail={names.of(draft.language)} title={draft.title} />
    </CardLink>
  );
}
