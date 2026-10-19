import { CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The most rows one tile lists. A tile with more rows ends with All exams, when the viewer may open the exams. */
export const TILE_ROWS = 3;

/**
 * One tile of the school home: a card with its title, its rows, and a footer with one concise sentence and at
 * most one action. The rows fill the body, and the footer stays at the foot of the tile, so the tiles of a row
 * line up. Each row is an action, so a tile holds no primary button.
 */
export function HomeTile({
  action,
  children,
  className,
  hint,
  title,
}: {
  /** The footer's action, which a tile with more rows than it shows offers as All exams. */
  action?: ReactNode;
  /** The tile's rows, each of which opens a page. */
  children: ReactNode;
  className?: string | undefined;
  /** The one concise sentence of the footer, which says what the rows are for. */
  hint: string;
  title: string;
}) {
  return (
    <CardSection className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="flex-1">{children}</div>
      <CardSectionFooter hint={hint}>
        {action === undefined ? null : (
          <CardSectionActions>{action}</CardSectionActions>
        )}
      </CardSectionFooter>
    </CardSection>
  );
}

/** The footer's All exams, which opens the list of exams for the rows that a tile does not show. */
export function AllExamsAction() {
  const t = useTranslations("School");

  return (
    <IntentLink
      className={buttonVariants({ variant: "outline" })}
      href="/exams"
      localized={false}
    >
      {t("tile-all-exams")}
    </IntentLink>
  );
}

/** A row's two lines: its title, and an optional second line of detail, each on one line that truncates. */
export function RowText({
  detail,
  title,
}: {
  detail?: string | undefined;
  title: string;
}) {
  return (
    <span className="grid min-w-0 flex-1 gap-0.5">
      <span className="truncate font-medium">{title}</span>
      {detail === undefined ? null : (
        <span className="truncate text-muted-foreground text-xs">{detail}</span>
      )}
    </span>
  );
}
