import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/design-system/components/ui/alert";
import { ToastMessage } from "@repo/design-system/lib/toast/message";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";

/**
 * Why a dialog's save was refused, inside the dialog that stays open, in the same copy its toast
 * would show, so the person fixes what the server named without losing what they wrote.
 */
export function DialogRefusal({ copy }: { copy: ToastCopy }) {
  return (
    <Alert role="alert" variant="destructive">
      <AlertTitle>
        <ToastMessage message={copy.title} values={copy.values} />
      </AlertTitle>
      {copy.description === undefined ? null : (
        <AlertDescription>
          <ToastMessage message={copy.description} values={copy.values} />
        </AlertDescription>
      )}
    </Alert>
  );
}
