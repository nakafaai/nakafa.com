import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { lazy } from "@repo/design-system/lib/lazy";
import { Array as Arr } from "effect";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { PaneFill } from "@/components/shared/page/pane";
import type { SchoolBilling } from "@/lib/billing/school";

/** The invoices table's code, which the first intent on the card's action loads, so the sheet opens on its table. */
const SchoolInvoices = lazy(() =>
  import("@/components/tenant/settings/ledger").then((module) => ({
    default: module.SchoolInvoices,
  }))
);

/**
 * The invoices card: its one action opens a sheet of every invoice the school was
 * issued, which filters by each column and hands over each invoice's PDF and payment.
 */
export function SchoolInvoicesCard({
  billing: overview,
}: {
  billing: SchoolBilling;
}) {
  const t = useTranslations("SchoolSettings");
  const [isActivated, setIsActivated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const hasInvoices = Arr.isReadonlyArrayNonEmpty(overview.invoices);

  return (
    <CardSection
      description={t("billing-invoices-description")}
      title={t("billing-invoices")}
    >
      <CardSectionFooter
        hint={
          hasInvoices
            ? t("billing-invoices-footer", { count: overview.invoices.length })
            : t("billing-invoices-empty")
        }
      >
        <CardSectionActions>
          <Button
            disabled={!hasInvoices}
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
            {t("billing-invoices-view")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
      <Sheet onOpenChange={setIsOpen} open={isOpen}>
        <SheetContent className="w-full max-w-none" size="xl">
          <SheetHeader>
            <SheetTitle>{t("billing-invoices")}</SheetTitle>
            <SheetDescription>
              {t("billing-invoices-description")}
            </SheetDescription>
          </SheetHeader>
          {isActivated ? (
            <PaneFill>
              <Suspense fallback={<PopupHold />}>
                <SchoolInvoices billing={overview} />
              </Suspense>
            </PaneFill>
          ) : null}
          <SheetFooter>
            <p className="text-muted-foreground text-sm">
              {t("billing-invoices-sheet-footer")}
            </p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </CardSection>
  );
}
