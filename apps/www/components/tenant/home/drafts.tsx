"use client";

import { QueryResult } from "@confect/react";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useHomeExams } from "@/components/tenant/home/query.client";
import { HomeTile, RowText, TileEmpty } from "@/components/tenant/home/tile";

/** One draft of the viewer, as the school home holds it. */
type Draft = (typeof HomeView.Type)["drafts"][number];

/**
 * The exams the viewer started and may still edit, newest created first, each with its language. A row
 * opens its editor, and the footer's action opens every exam.
 */
export function DraftsTile({ className }: { className?: string | undefined }) {
  const t = useTranslations("School");
  const locale = useLocale();
  const exams = useHomeExams();
  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  return (
    <HomeTile
      action={
        <Link className={buttonVariants({ variant: "outline" })} href="/exams">
          {t("tile-all-exams")}
        </Link>
      }
      className={className}
      hint={t("tile-drafts-footer")}
      title={t("tile-drafts")}
    >
      {QueryResult.isSuccess(exams) ? (
        <DraftRows drafts={exams.value.drafts} names={names} />
      ) : null}
    </HomeTile>
  );
}

/** The drafts as rows, or the tile's empty state while the viewer has none. */
function DraftRows({
  drafts,
  names,
}: {
  drafts: readonly Draft[];
  names: Intl.DisplayNames;
}) {
  const t = useTranslations("School");

  if (Arr.isReadonlyArrayEmpty(drafts)) {
    return <TileEmpty act="writing">{t("tile-drafts-empty")}</TileEmpty>;
  }
  return (
    <CardLinks>
      {Arr.map(drafts, (draft) => (
        <CardLink
          href={`/exams/${draft.id}/edit`}
          key={draft.id}
          localized={false}
          title={draft.title}
        >
          <RowText detail={names.of(draft.language)} title={draft.title} />
        </CardLink>
      ))}
    </CardLinks>
  );
}
