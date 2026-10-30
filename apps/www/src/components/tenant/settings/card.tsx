import { useMutation } from "@confect/react";
import { useClipboard } from "@mantine/hooks";
import { Id } from "@repo/backend/confect/_generated/id";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cva } from "class-variance-authority";
import { Schema } from "effect";
import { type ReactNode, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { QrImage } from "@/components/shared/qr/image";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolDateTime } from "@/components/tenant/settings/time";
import { schoolOrigin } from "@/lib/routing/school/host";

const SOURCE = "components/tenant/settings/card";

/**
 * A login card as the page holds it: the code the server answered once, the login
 * name it signs in with, when the code stops working, the student's name, and the
 * Person the card belongs to.
 */
const CardView = Schema.Struct({
  code: Schema.String,
  expiresAt: Schema.Finite,
  loginName: Schema.String,
  name: PersonName,
  personId: Id("tenantPeople"),
});
export type CardView = typeof CardView.Type;

/**
 * Hides every other child of the body while the browser prints, so the sheet is the
 * only thing on the page. The sheet stays mounted under the body while the card is open.
 */
const PRINT_ONLY_SHEET =
  "@page { margin: 10mm; } @media print { body > :not([data-school-card-sheet]) { display: none !important; } }";

/**
 * The value of one card line. A code and a login name stay on one line in the mono
 * face; a student's name wraps inside the card, so a long name never leaves it.
 */
const cardValue = cva("min-w-0 font-medium", {
  variants: {
    mono: {
      false: "break-words",
      true: "whitespace-nowrap font-mono",
    },
  },
});

/**
 * The login card dialog. It shows the card once, with a copy action and a print
 * action, and closing it leaves no copy of the code on the page. Printing records the
 * print in the school's journal, then opens the browser's print sheet. The printed
 * sheet is mounted under the body, hidden on the screen, and shown only when the
 * browser prints.
 */
export function SchoolCardDialog({
  card,
  onClose,
}: {
  card: CardView | undefined;
  onClose: () => void;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const clipboard = useClipboard({ timeout: 1500 });
  const printCard = useMutation(identity.cards.print);
  const [isPrinting, startPrinting] = useTransition();

  return (
    <ResponsiveDialog
      description={t("card-code-description")}
      footer={
        <>
          <p className="me-auto text-muted-foreground text-sm">
            {t("card-print-footer")}
          </p>
          <Button
            onClick={() => {
              if (card !== undefined) {
                clipboard.copy(card.code);
              }
            }}
            type="button"
            variant="outline"
          >
            {clipboard.copied ? t("card-copied") : t("card-copy")}
          </Button>
          <Button
            disabled={isPrinting}
            inert={isPrinting}
            onClick={() => {
              if (card !== undefined) {
                const { personId } = card;
                // The sheet opens once the journal holds the print, so a refused print never prints.
                startPrinting(() =>
                  saveSchool(
                    () => printCard({ personId, slug }),
                    SOURCE,
                    () => window.print()
                  )
                );
              }
            }}
            type="button"
          >
            {t("card-print")}
          </Button>
        </>
      }
      open={card !== undefined}
      setOpen={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={t("card-issue-title")}
    >
      {card === undefined ? null : (
        <>
          <SchoolCardFace card={card} />
          {typeof document === "undefined"
            ? null
            : createPortal(
                <SchoolCardSheet>
                  <SchoolCardFace card={card} />
                </SchoolCardSheet>,
                document.body
              )}
        </>
      )}
    </ResponsiveDialog>
  );
}

/**
 * The printed sheet of one card. It holds the card the caller composes in its own area,
 * hidden on the screen and shown only when the browser prints.
 */
function SchoolCardSheet({ children }: { children: ReactNode }) {
  return (
    <div
      className="hidden w-[85.6mm] bg-white p-[4mm] text-black print:block"
      data-school-card-sheet=""
    >
      <style>{PRINT_ONLY_SHEET}</style>
      {children}
    </div>
  );
}

/**
 * The face of one login card: the school address, the student, the username, the code,
 * and when the code stops working. The QR code holds the code alone.
 */
function SchoolCardFace({ card }: { card: CardView }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const address = schoolOrigin(slug).host;

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <p className="font-medium text-sm">{address}</p>
      <div className="flex items-start justify-between gap-4">
        <dl className="grid min-w-0 gap-3 text-sm">
          <CardField label={t("card-student")} value={card.name} />
          <CardField label={t("card-username")} mono value={card.loginName} />
          <CardField label={t("card-code")} mono value={card.code} />
          <div>
            <dt className="text-muted-foreground">{t("card-expires")}</dt>
            <dd>
              <SchoolDateTime at={card.expiresAt} />
            </dd>
          </div>
        </dl>
        <QrImage label={t("card-qr-label")} size="card" text={card.code} />
      </div>
    </div>
  );
}

/** One labelled line of the card, in the body face unless it is a code or a login name. */
function CardField({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cardValue({ mono })}>{value}</dd>
    </div>
  );
}
