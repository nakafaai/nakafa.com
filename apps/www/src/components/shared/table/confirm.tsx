import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ComponentProps, type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";
import { RowItems } from "@/components/shared/table/menu";

/** An icon of the design system's set, as `HugeIcons` draws it. */
type Icon = ComponentProps<typeof HugeIcons>["icon"];

/**
 * What a confirmation takes away, as its body shows it: the record's icon and name, and what goes with it when that
 * says more than the name, in one outlined row, as the chat's delete shows the chat it removes.
 */
export function ConfirmSubject({
  detail,
  icon,
  name,
}: {
  /** What goes with the record, such as how many items it holds. */
  readonly detail?: string;
  readonly icon: Icon;
  readonly name: string;
}) {
  return (
    <Item size="sm" variant="outline">
      <ItemMedia variant="icon">
        <HugeIcons icon={icon} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="line-clamp-2" dir="auto">
          {name}
        </ItemTitle>
        {detail === undefined ? null : (
          <ItemDescription>{detail}</ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}

/**
 * What the menu of one table row holds when its last action is destructive: the row's main actions, a separator, then the
 * menu's footer, an archive action where the row has one and the destructive action last with its icon. The action opens
 * a confirmation whose body shows what it loses, and `onConfirm` runs only once the viewer confirms it, so nothing is
 * removed by a single click. A row that may not take the action now keeps it in view, disabled (`disabled`); a row the
 * server would refuse leaves it out (`offered`), so the menu never offers what fails.
 */
export function ConfirmRowMenu({
  action,
  body,
  children,
  confirm,
  description,
  disabled = false,
  footer,
  icon,
  offered = true,
  onConfirm,
  title,
}: {
  readonly action: string;
  /** What the confirmation shows the action loses, such as the record it deletes. */
  readonly body?: ReactNode;
  /** The row's main actions, above the separator. */
  readonly children?: ReactNode;
  readonly confirm: string;
  readonly description: string;
  /** Whether this row may not take the destructive action. */
  readonly disabled?: boolean;
  /** The footer's action before the destructive one, such as Archive. */
  readonly footer?: ReactNode;
  readonly icon: Icon;
  /** Whether the menu offers the destructive action at all, as the server would take it. */
  readonly offered?: boolean;
  readonly onConfirm: () => void;
  readonly title: string;
}) {
  const common = useTranslations("Common");
  const [isConfirming, setIsConfirming] = useState(false);
  const hasFooter = footer !== undefined || offered;

  return (
    <>
      <RowItems>
        {children}
        {children !== undefined && hasFooter ? <DropdownMenuSeparator /> : null}
        {footer}
        {offered ? (
          <DropdownMenuItem
            disabled={disabled}
            onClick={() => setIsConfirming(true)}
            variant="destructive"
          >
            <HugeIcons icon={icon} />
            {action}
          </DropdownMenuItem>
        ) : null}
      </RowItems>
      {offered ? (
        <ResponsiveDialog
          description={description}
          footer={
            <>
              <Button
                onClick={() => setIsConfirming(false)}
                type="button"
                variant="outline"
              >
                {common("cancel")}
              </Button>
              <Button
                onClick={() => {
                  setIsConfirming(false);
                  onConfirm();
                }}
                type="button"
                variant="destructive"
              >
                {confirm}
              </Button>
            </>
          }
          open={isConfirming}
          setOpen={setIsConfirming}
          title={title}
        >
          {body}
        </ResponsiveDialog>
      ) : null}
    </>
  );
}
