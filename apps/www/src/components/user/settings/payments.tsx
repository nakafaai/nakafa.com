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
import { lazy } from "@repo/design-system/lib/lazy";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";

/** The receipts table's code, which the first intent on the card's action loads, so the sheet opens on its table. */
const Receipts = lazy(() =>
  import("@/components/user/settings/receipts").then((module) => ({
    default: module.Receipts,
  }))
);

/**
 * The payments card: its one action opens a sheet of the learner's whole payment
 * history, which grows with every renewal, filters by each column, and hands over
 * the invoice of each payment.
 */
export function UserSettingsPayments() {
  const t = useTranslations("Auth");
  const common = useTranslations("Common");
  const [isActivated, setIsActivated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CardSection
      description={t("payments-card-description")}
      title={t("payments")}
    >
      <CardSectionFooter hint={t("payments-footer")}>
        <CardSectionActions>
          <Button
            onClick={() => {
              setIsActivated(true);
              setIsOpen(true);
            }}
            onFocus={() => setIsActivated(true)}
            onPointerEnter={() => setIsActivated(true)}
            type="button"
          >
            <HugeIcons icon={Invoice01Icon} />
            {t("payments-view")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
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
    </CardSection>
  );
}
