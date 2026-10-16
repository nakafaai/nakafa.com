import { Schema } from "effect";
import { type ExternalToast, toast as sonner } from "sonner";

/**
 * The options of a toast the app shows. The description, the action and the
 * place are copy and layout the app chooses; the Toaster keeps the rest.
 */
type ToastOptions = Pick<
  ExternalToast,
  "action" | "description" | "duration" | "id" | "position"
>;

/**
 * The copy of one toast: a title, and the description under it when it has
 * one. A caller that passes copy on to the helper passes this shape.
 */
const ToastCopySchema = Schema.Struct({
  description: Schema.optional(Schema.String),
  title: Schema.String,
});
export type ToastCopy = typeof ToastCopySchema.Type;

/**
 * The one way the app shows a toast. Its title takes one line and its
 * description at most two, which the Toaster clamps, and every word of it is a
 * dictionary message: the source check rejects literal text, and the copy test
 * measures every message of the `Toast` namespace.
 */
export const toast = {
  /** Shows a toast that reports a failure. */
  error: (title: string, options?: ToastOptions) =>
    sonner.error(title, options),
  /** Shows a toast that reports information. */
  info: (title: string, options?: ToastOptions) => sonner.info(title, options),
  /** Shows a plain toast, such as one that offers an action. Returns its id. */
  message: (title: string, options?: ToastOptions) => sonner(title, options),
  /** Shows a toast that reports success. */
  success: (title: string, options?: ToastOptions) =>
    sonner.success(title, options),
  /** Closes the toast with this id, or every toast when no id is given. */
  dismiss: (id?: string | number) => sonner.dismiss(id),
};
