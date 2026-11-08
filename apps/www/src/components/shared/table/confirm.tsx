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
 * The menu of one table row, read as a header, a body and a footer: its label, the row's main actions (`children`), then
 * under a separator its archive (`archive`) and its destructive action last. The destructive action opens a confirmation
 * whose body shows what it takes away (`subject`), and `onConfirm` runs only once the viewer confirms it, so nothing is
 * removed by a single click. A row the server would refuse leaves the action out (`offered`), so the menu never offers
 * what fails.
 */
export function ConfirmRowMenu({
  action,
  archive,
  children,
  confirm,
  description,
  icon,
  offered = true,
  onConfirm,
  subject,
  title,
}: {
  readonly action: string;
  /** The row's archive, which stands in the footer above the destructive action. */
  readonly archive?: ReactNode;
  /** The row's main actions, above the separator. */
  readonly children?: ReactNode;
  readonly confirm: string;
  readonly description: string;
  readonly icon: Icon;
  /** Whether this row takes the destructive action now, as the server would. */
  readonly offered?: boolean;
  readonly onConfirm: () => void;
  /** What the action takes away, in the confirmation's body. */
  readonly subject?: ComponentProps<typeof ConfirmSubject>;
  readonly title: string;
}) {
  const common = useTranslations("Common");
  const [isConfirming, setIsConfirming] = useState(false);
  const hasFooter = archive !== undefined || offered;

  return (
    <>
      <RowItems>
        {children}
        {children !== undefined && hasFooter ? <DropdownMenuSeparator /> : null}
        {archive}
        {offered ? (
          <DropdownMenuItem
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
          {subject === undefined ? undefined : <ConfirmSubject {...subject} />}
        </ResponsiveDialog>
      ) : null}
    </>
  );
}
