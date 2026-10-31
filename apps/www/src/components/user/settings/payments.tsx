import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { lazy, Suspense, useState } from "react";
import { useTranslations } from "use-intl";

/** The receipts table's code, which the first intent on Payments loads, so the sheet opens on its table. */
const Receipts = lazy(() =>
  import("@/components/user/settings/receipts").then((module) => ({
    default: module.Receipts,
  }))
);

/**
 * The plan card's Payments action: a sheet of the learner's whole payment
 * history, which grows with every renewal and filters by each column.
 */
export function PlanPayments() {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const [isActivated, setIsActivated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => {
          setIsActivated(true);
          setIsOpen(true);
        }}
        onFocus={() => setIsActivated(true)}
        onPointerEnter={() => setIsActivated(true)}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={Invoice01Icon} />
        {t("payments")}
      </Button>
      <Sheet onOpenChange={setIsOpen} open={isOpen}>
        <SheetContent className="w-full max-w-none sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t("payments")}</SheetTitle>
            <SheetDescription>{t("payments-description")}</SheetDescription>
          </SheetHeader>
          {isActivated ? (
            <Suspense fallback={null}>
              <Receipts />
            </Suspense>
          ) : null}
          <SheetFooter>
            <SheetClose
              render={
                <Button type="button" variant="outline">
                  {common("close")}
                </Button>
              }
            />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
