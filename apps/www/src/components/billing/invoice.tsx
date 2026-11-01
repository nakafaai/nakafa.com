import { Button } from "@repo/design-system/components/ui/button";
import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, type Result } from "effect";
import { type ComponentProps, useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import { invoiceBlob } from "@/lib/billing/invoice";

/** What a buyer reads when an invoice cannot be drawn. */
const INVOICE_FAILURE_COPY: ToastCopy = {
  description: "invoice-error.description",
  title: "invoice-error.title",
};

/** Hands the buyer one drawn invoice as a file. */
const saveInvoice = (blob: Blob, name: string) =>
  Effect.sync(() => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  });

/** One row's action: an icon button that names itself in a tooltip and shows its work. */
export function RowAction({
  icon,
  isPending,
  label,
  onClick,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  isPending: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={isPending}
            onClick={onClick}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Spinner icon={icon} isLoading={isPending} />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Asks for one invoice, saves the file, and says so in a toast when it cannot be drawn. */
export function useInvoiceDownload() {
  const [isPending, startTransition] = useTransition();

  const download = (
    request: () => Promise<
      Result.Result<{ readonly base64: string; readonly name: string }, unknown>
    >
  ) => {
    startTransition(() =>
      Effect.runPromise(
        Effect.tryPromise(request).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.flatMap((file) =>
            invoiceBlob(file.base64).pipe(
              Effect.flatMap((blob) => saveInvoice(blob, file.name))
            )
          ),
          Effect.tapError((cause) =>
            reportClientException(cause, { source: "settings-invoice" })
          ),
          Effect.catchCause(() =>
            Effect.sync(() => {
              toast.error(INVOICE_FAILURE_COPY, { position: "bottom-center" });
            })
          )
        )
      )
    );
  };

  return { download, isPending };
}
