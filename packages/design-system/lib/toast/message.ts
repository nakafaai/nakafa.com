import type {
  ToastDescriptionKey,
  ToastTitleKey,
  ToastValues,
} from "@repo/internationalization/src/toast";
import { useTranslations } from "use-intl";

/**
 * One line of toast copy: a message of the `Toast` namespace in the reader's
 * language. The helper hands Sonner this node with the key and its values, and
 * Sonner renders it inside the Toaster, so a toast fired outside React still
 * reads in the reader's language.
 */
export function ToastMessage({
  message,
  values,
}: {
  message: ToastTitleKey | ToastDescriptionKey;
  values?: ToastValues | undefined;
}) {
  const t = useTranslations("Toast");
  return t(message, values);
}
