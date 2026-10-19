"use client";

import { useMutation } from "@confect/react";
import { useClipboard } from "@mantine/hooks";
import { Id } from "@repo/backend/confect/_generated/id";
import identity from "@repo/backend/confect/_generated/refs/identity";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cva } from "class-variance-authority";
import { Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition } from "react";
import { createPortal } from "react-dom";
import { cardQr } from "@/components/tenant/settings/card.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
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
  slug,
}: {
  card: CardView | undefined;
  onClose: () => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const clipboard = useClipboard({ timeout: 1500 });
  const printCard = useMutation(identity.cards.print);

  return (
    <ResponsiveDialog
      description={t("card-code-description")}
      footer={
        <>
          <p className="mr-auto text-muted-foreground text-sm">
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
            onClick={() => {
              if (card !== undefined) {
                const { personId } = card;
                startTransition(() =>
                  saveSchool(() => printCard({ personId, slug }), SOURCE)
                );
              }
              window.print();
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
          <SchoolCardFace card={card} slug={slug} />
          {typeof document === "undefined"
            ? null
            : createPortal(
                <SchoolCardSheet card={card} slug={slug} />,
                document.body
              )}
        </>
      )}
    </ResponsiveDialog>
  );
}

/**
 * The printed sheet of one card. It holds one card in its own area, hidden on the
 * screen and shown only when the browser prints.
 */
function SchoolCardSheet({ card, slug }: { card: CardView; slug: TenantSlug }) {
  return (
    <div
      className="hidden w-[85.6mm] bg-white p-[4mm] text-black print:block"
      data-school-card-sheet=""
    >
      <style>{PRINT_ONLY_SHEET}</style>
      <SchoolCardFace card={card} slug={slug} />
    </div>
  );
}

/**
 * The face of one login card: the school address, the student, the username, the code,
 * and when the code stops working. The QR code holds the code alone.
 */
function SchoolCardFace({ card, slug }: { card: CardView; slug: TenantSlug }) {
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
              <SchoolDateTime at={card.expiresAt} slug={slug} />
            </dd>
          </div>
        </dl>
        <CardQrCode card={card} label={t("card-qr-label")} />
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

/**
 * The QR code of the card, drawn in dark modules on a white quiet zone so every
 * reader scans it in any theme.
 */
function CardQrCode({ card, label }: { card: CardView; label: string }) {
  const { path, size } = cardQr(card);
  const quiet = 4;

  return (
    <svg
      aria-label={label}
      className="size-24 shrink-0"
      role="img"
      shapeRendering="crispEdges"
      viewBox={`${-quiet} ${-quiet} ${size + quiet * 2} ${size + quiet * 2}`}
    >
      <rect
        fill="#ffffff"
        height={size + quiet * 2}
        width={size + quiet * 2}
        x={-quiet}
        y={-quiet}
      />
      <path d={path} fill="#000000" />
    </svg>
  );
}
