import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Calendar01Icon,
  Calendar02Icon,
  Calendar03Icon,
  Calendar04Icon,
  CheckmarkBadge01Icon,
  Download04Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { checkAddress } from "@/components/tenant/reports/check";

/** One locked report card of the viewer, as their report cards page lists it. */
type OwnCard = Ref.Returns<typeof records.reports.own>[number];

/** The icons of the period filter, one for each period while the pool has one free. */
const PERIOD_ICONS = [
  Calendar03Icon,
  Calendar01Icon,
  Calendar02Icon,
  Calendar04Icon,
] as const;

/** The columns of the report cards table. */
const cardColumns = tableColumns<OwnCard>();

/**
 * The viewer's own locked report cards in the school, the newest first: a table that finds a class group, filters by
 * period, and sorts by the approval date, with each card's PDF and its public check page. The header's search stands
 * from the first paint, and the table waits for its rows, so no empty state shows before they arrive.
 */
export function SchoolOwnReports() {
  const t = useTranslations("SchoolReports");

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("own-title") }]} title={t("own-title")}>
        <TableSearch placeholder={t("own-search")} />
      </SchoolHeader>
      <TablePageBody>
        <OwnReportTable />
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The table of the viewer's report cards, or the sentence of a viewer who has none locked yet. */
function OwnReportTable() {
  const t = useTranslations("SchoolReports");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();
  const locale = useLocale();
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cards = useQuery(records.reports.own, isSettled ? { slug } : "skip");
  if (QueryResult.isFailure(cards)) {
    throw cards.error;
  }
  if (!QueryResult.isSuccess(cards)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(cards.value)) {
    return (
      <TableEmpty
        act="relaxed"
        description={t("own-empty-description")}
        title={t("own-empty")}
      />
    );
  }

  const periods = Arr.dedupe(Arr.map(cards.value, (card) => card.period));
  const columns = [
    cardColumns.text((card) => card.cohort, {
      cell: (info) => (
        <TableTitle icon={UserGroupIcon}>{info.getValue()}</TableTitle>
      ),
      header: t("cohort"),
      id: "cohort",
    }),
    cardColumns.values((card) => card.period, {
      header: t("period"),
      id: "period",
      options: namedOptions(periods, PERIOD_ICONS),
    }),
    cardColumns.days((card) => card.approvedAt, {
      cell: (info) => (
        <span className="tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      header: t("approved-at"),
      id: "approved",
      timeZone: formatZone,
    }),
    cardColumns.menu((info) => (
      <div className="flex justify-end gap-2">
        <Button
          render={
            <a
              href={checkAddress(locale, info.row.original.hash)}
              rel="noopener"
              target="_blank"
            >
              <HugeIcons icon={CheckmarkBadge01Icon} />
              {t("open-check")}
            </a>
          }
          size="sm"
          variant="outline"
        />
        <Button
          render={
            <a href={info.row.original.file} rel="noopener" target="_blank">
              <HugeIcons icon={Download04Icon} />
              {t("open-pdf")}
            </a>
          }
          size="sm"
          variant="outline"
        />
      </div>
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={cards.value}
      rowId={(card) => card.id}
      search="cohort"
    />
  );
}
