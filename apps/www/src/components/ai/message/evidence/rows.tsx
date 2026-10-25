import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

/** How many rows of an evidence list show before its button is pressed. */
const SHOWN_ROWS = 5;

/**
 * The first rows of an evidence list, and the rest behind one button. Every
 * list of evidence that can grow long uses it, so each one is cut at the same
 * place and opens with the same button. The rows come as elements, so a server
 * component can hand them over, and only the rows that show are mounted.
 */
export function Rows({ children }: { children: readonly ReactNode[] }) {
  const t = useTranslations("Ai");
  const [expanded, { toggle }] = useDisclosure(false);

  return (
    <>
      {expanded ? children : Arr.take(children, SHOWN_ROWS)}
      {children.length > SHOWN_ROWS ? (
        <Button
          className="self-start"
          onClick={toggle}
          size="sm"
          variant="outline"
        >
          {expanded ? t("show-less") : t("show-more")}
          <HugeIcons icon={expanded ? ArrowUp01Icon : ArrowDown01Icon} />
        </Button>
      ) : null}
    </>
  );
}
