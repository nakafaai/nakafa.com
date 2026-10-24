import { CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/link";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";

/** The most rows one tile lists. A tile with more rows ends with All exams, when the viewer may open the exams. */
export const TILE_ROWS = 3;

/**
 * One tile of the school home: a card with its title, its rows, and a footer with one concise sentence and at
 * most one action. The body grows to the height of its row of tiles, so the tiles line up, and its rows sit at its
 * top. The card's gap separates the footer from the body, so the body's last row takes no card spacing beneath it:
 * the room a short tile has left goes below the rows. Each row is an action, so a tile holds no primary button.
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
      <div className="flex-1 [--card-spacing:0]">{children}</div>
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
  const { slug } = useTenant();

  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      params={{ slug }}
      to="/school/$slug/exams"
    >
      {t("tile-all-exams")}
    </Link>
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
      <span className="truncate font-medium" dir="auto">
        {title}
      </span>
      {detail === undefined ? null : (
        <span className="truncate text-muted-foreground text-xs" dir="auto">
          {detail}
        </span>
      )}
    </span>
  );
}
