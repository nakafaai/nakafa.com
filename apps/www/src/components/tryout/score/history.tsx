import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ArrowDown01Icon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { rowLineVariants } from "@repo/design-system/lib/row";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { useFactsWaiting } from "@/components/tryout/section/summary";
import { KEPT_ATTEMPT_SCRIPT } from "@/components/tryout/set/kept";
import type { CurrentAttempt, SetPage } from "@/components/tryout/set/model";
import {
  useKeepAttemptLabel,
  useKeptPageAttempt,
} from "@/components/tryout/set/name";
import { formatMoment } from "@/lib/i18n/date";

type HistoryQuery = typeof tryouts.queries.history.bySet;
type HistoryIdentity = Omit<Ref.Args<HistoryQuery>, "paginationOpts">;
type HistoryRow = Ref.Returns<HistoryQuery>["page"][number];
type ScoredHistoryRow = TryoutAttemptHistoryProps["value"]["attempts"][number];

/** One attempt of the picker, named by its number, with the moment it started under it. */
function TryoutAttemptOption({
  attempt,
  locale,
  onChoose,
  selected,
}: {
  attempt: ScoredHistoryRow;
  locale: HistoryIdentity["locale"];
  onChoose: () => void;
  selected: boolean;
}) {
  const t = useTranslations("Tryouts");

  return (
    <PickerItem
      icon={TransactionHistoryIcon}
      onClick={onChoose}
      selected={selected}
      value={attempt}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={rowLineVariants()}>
          {t("attempt-select-label", { number: attempt.attemptNumber })}
        </span>
        <span className={rowLineVariants({ line: "fact" })}>
          {formatMoment(attempt.startedAt, locale)}
        </span>
      </span>
    </PickerItem>
  );
}

/** Props of the attempt-history picker: `value` holds the scored attempts and the selection. */
interface TryoutAttemptHistoryProps {
  value: {
    attempts: readonly (HistoryRow & {
      score: NonNullable<HistoryRow["score"]>;
    })[];
    locale: HistoryIdentity["locale"];
    onLoadMore: (() => void) | undefined;
    onChoose: (attemptId: HistoryRow["attemptId"]) => void;
    /** The page's path and search, which a kept label is read by. */
    pathname: string;
    search: string;
    selectedAttemptId: HistoryRow["attemptId"];
  };
}

/** What the picker shows, which its place at first paint draws too, so the two stand pixel for pixel. */
function TryoutAttemptFace({ children }: { children?: ReactNode }) {
  return (
    <>
      <HugeIcons icon={TransactionHistoryIcon} />
      <HeaderLabel>{children}</HeaderLabel>
      <HugeIcons
        className="tryout-history-chevron ml-auto size-4 transition-transform ease-out @max-2xl/header:hidden"
        icon={ArrowDown01Icon}
      />
    </>
  );
}

/**
 * The picker's place until a learner's read answers. A button that appears late is a flicker, so a set
 * this browser saw tried more than once shows its picker from the first frame, and the live one
 * replaces it where it stands. A first visit has nothing to draw, so its place stays empty.
 */
function TryoutAttemptPlace() {
  const label = useKeptPageAttempt();
  return (
    <Button
      data-attempt-picker=""
      // Hidden by its attribute, so the group's next part keeps its rounded start until the place shows.
      hidden={label === undefined}
      inert
      type="button"
      variant="outline"
    >
      <TryoutAttemptFace>
        <span
          className="before:content-[attr(data-label)]"
          data-label={label ?? ""}
        />
      </TryoutAttemptFace>
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only
        dangerouslySetInnerHTML={{ __html: KEPT_ATTEMPT_SCRIPT }}
        suppressHydrationWarning
      />
    </Button>
  );
}

/** The picker of a set's scored attempts, newest first, which loads older attempts as its end comes into view. */
function TryoutAttemptHistory({ value }: TryoutAttemptHistoryProps) {
  const tTryouts = useTranslations("Tryouts");
  const labelOf = (attempt: ScoredHistoryRow) =>
    tTryouts("attempt-select-label", { number: attempt.attemptNumber });
  const latest = Option.map(Arr.head(value.attempts), labelOf);
  const label = Option.orElse(
    Option.map(
      Arr.findFirst(
        value.attempts,
        (attempt) => attempt.attemptId === value.selectedAttemptId
      ),
      labelOf
    ),
    () => latest
  );
  // The set's own address opens the latest attempt, whichever attempt this page shows.
  useKeepAttemptLabel(value.pathname, Option.getOrUndefined(latest));
  useKeepAttemptLabel(
    `${value.pathname}${value.search}`,
    Option.getOrUndefined(label)
  );

  if (Option.isNone(label)) {
    return null;
  }

  return (
    <Picker>
      <PickerTrigger
        render={
          <Button
            className="group data-open:[&_.tryout-history-chevron]:rotate-180"
            data-attempt-picker=""
            type="button"
            variant="outline"
          />
        }
      >
        <TryoutAttemptFace>{label.value}</TryoutAttemptFace>
      </PickerTrigger>
      <PickerContent
        empty={tTryouts("attempt-menu-empty")}
        items={value.attempts}
        itemToStringValue={(attempt) =>
          `${labelOf(attempt)} ${formatMoment(attempt.startedAt, value.locale)}`
        }
        label={tTryouts("menu-history")}
        onEnd={value.onLoadMore}
        placeholder={tTryouts("attempt-menu-search-placeholder")}
      >
        {(attempt) => (
          <TryoutAttemptOption
            attempt={attempt}
            key={attempt.attemptId}
            locale={value.locale}
            onChoose={() => value.onChoose(attempt.attemptId)}
            selected={attempt.attemptId === value.selectedAttemptId}
          />
        )}
      </PickerContent>
    </Picker>
  );
}

/**
 * The picker of a set's attempts, for the page's header, once a set has been tried more than once.
 * Choosing an attempt opens that attempt's page, so the score and the review always belong to one
 * attempt. A page whose attempt has no score has nothing to pick from.
 */
export function TryoutAttemptPicker({
  attempt,
  locale,
  set,
}: {
  readonly attempt:
    | Pick<CurrentAttempt, "attemptId" | "score">
    | null
    | undefined;
  readonly locale: HistoryIdentity["locale"];
  readonly set: SetPage["set"];
}) {
  const waiting = useFactsWaiting(attempt === undefined);
  if (waiting) {
    return <TryoutAttemptPlace />;
  }
  if (!attempt?.score) {
    return null;
  }
  return (
    <TryoutAttemptChoice
      attemptId={attempt.attemptId}
      identity={{
        countryKey: set.countryKey,
        examKey: set.examKey,
        locale,
        setKey: set.setKey,
        trackKey: set.trackKey,
      }}
      publicPath={set.publicPath}
    />
  );
}

/** Reads a set's attempts for the picker, which waits until there is more than one to pick from. */
function TryoutAttemptChoice({
  attemptId,
  identity,
  publicPath,
}: {
  readonly attemptId: HistoryRow["attemptId"];
  readonly identity: HistoryIdentity;
  readonly publicPath: string;
}) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const navigate = useNavigate();
  const history = usePaginatedQuery(
    tryouts.queries.history.bySet,
    isAuthenticated ? identity : "skip",
    { initialNumItems: 25 }
  );
  const firstPage = PaginatedQueryResult.isLoadingFirstPage(history);
  const attempts = useKeptAttempts(
    Arr.filter(history.results, hasScore),
    firstPage
  );
  const { pathname, searchStr } = useLocation();

  if (attempts.length < 2) {
    return firstPage ? <TryoutAttemptPlace /> : null;
  }
  return (
    <TryoutAttemptHistory
      value={{
        attempts,
        locale: identity.locale,
        onLoadMore: PaginatedQueryResult.isCanLoadMore(history)
          ? () => history.loadMore(25)
          : undefined,
        onChoose: (chosen) => {
          if (chosen === attemptId) {
            return;
          }
          navigate({
            href: `/${identity.locale}${getTryoutAttemptHref(publicPath, chosen, Option.none())}`,
          });
        },
        pathname,
        search: searchStr,
        selectedAttemptId: attemptId,
      }}
    />
  );
}

/**
 * The scored attempts the picker lists: the history's, or the last ones it listed while the history waits for
 * its first page, as during an auth reload that pauses the read. The picker never empties and leaves the
 * score card's header in the meantime. A history's rows never change once scored, so their attempts say
 * whether a new answer differs from the kept one.
 */
function useKeptAttempts(
  attempts: readonly ScoredHistoryRow[],
  waiting: boolean
) {
  const [kept, setKept] = useState(attempts);
  if (waiting) {
    return kept;
  }
  if (!sameAttempts(attempts, kept)) {
    setKept(attempts);
  }
  return attempts;
}

/** Whether two lists name the same attempts in the same order. */
function sameAttempts(
  left: readonly ScoredHistoryRow[],
  right: readonly ScoredHistoryRow[]
) {
  return Arr.makeEquivalence(
    (one: ScoredHistoryRow, other: ScoredHistoryRow) =>
      one.attemptId === other.attemptId
  )(left, right);
}

/** Narrows one attempt-history row to a persisted score result. */
function hasScore(row: HistoryRow): row is ScoredHistoryRow {
  return row.score !== null;
}
