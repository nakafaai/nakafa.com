import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { TableCell, TableRow } from "@repo/design-system/components/ui/table";
import { useRouter } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { TryoutStatus } from "@/components/tryout/status";

/** Renders a complete result while preserving row identity across updates. */
export function TryoutTableRows({
  emptyLabel,
  rows,
}: {
  emptyLabel: string;
  rows: readonly TryoutSetRow[];
}) {
  if (rows.length === 0) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell
          className="h-24 text-center text-muted-foreground"
          colSpan={5}
        >
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }
  return rows.map((row) => (
    <TryoutSetRowContent key={row.publicPath} row={row} />
  ));
}

/** Preserves the existing row-wide navigation and intent prefetch. */
function TryoutSetRowContent({ row }: { row: TryoutSetRow }) {
  const router = useRouter();
  const [intentActive, setIntentActive] = useState(false);
  const href = getTryoutPublicPathHref(row.publicPath);
  return (
    <TableRow
      className="cursor-pointer"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          return;
        }
        setIntentActive(true);
        router.push(href);
      }}
      onFocusCapture={() => setIntentActive(true)}
      onMouseEnter={() => setIntentActive(true)}
      onTouchStart={() => setIntentActive(true)}
    >
      <TableCell className="px-2 sm:px-4">
        <TryoutSetName intentActive={intentActive} row={row} />
      </TableCell>
      <TableCell className="px-2 text-center sm:px-4">
        <TryoutStatus status={row.attemptStatus} />
      </TableCell>
      <TableCell className="px-2 text-center tabular-nums sm:px-4">
        {row.readyQuestionCount}
      </TableCell>
      <TableCell className="px-2 text-center sm:px-4">
        <TryoutSetDuration seconds={row.durationSeconds} />
      </TableCell>
      <TableCell className="px-2 text-center tabular-nums sm:px-4">
        {row.publishedScore}
      </TableCell>
    </TableRow>
  );
}

/** The completion mark and score both describe the latest persisted attempt. */
function TryoutSetName({
  row,
  intentActive,
}: {
  row: TryoutSetRow;
  intentActive: boolean;
}) {
  return (
    <IntentLink
      className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline"
      href={getTryoutPublicPathHref(row.publicPath)}
      intentActive={intentActive}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          row.attemptStatus === "completed"
            ? "border-transparent bg-secondary text-secondary-foreground"
            : "border-muted-foreground/40"
        )}
      >
        {row.attemptStatus === "completed" && (
          <HugeIcons className="size-4" icon={CheckmarkCircle02Icon} />
        )}
      </span>
      <span className="truncate" title={row.title}>
        {row.title}
      </span>
    </IntentLink>
  );
}

/** Uses the signed allocation, including internal-entry sections. */
function TryoutSetDuration({ seconds }: { seconds: number }) {
  const t = useTranslations("Tryouts");
  return (
    <span className="whitespace-nowrap tabular-nums">
      {t("set-duration-minutes", { minutes: seconds / 60 })}
    </span>
  );
}
