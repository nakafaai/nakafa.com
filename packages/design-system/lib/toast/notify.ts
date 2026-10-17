import { ToastMessage } from "@repo/design-system/lib/toast/message";
import type {
  ToastDescriptionKey,
  ToastTitleKey,
  ToastValueKey,
  ToastValues,
} from "@repo/internationalization/src/toast";
import { createElement } from "react";
import { type ExternalToast, toast as sonner } from "sonner";

/**
 * The copy of a toast whose messages take no values. A key that interpolates a
 * value is left out, so a copy that names one must come with its values.
 */
type PlainCopy = Readonly<
  Record<"title", Exclude<ToastTitleKey, ToastValueKey>> &
    Partial<
      Record<"description", Exclude<ToastDescriptionKey, ToastValueKey>>
    > &
    Partial<Record<"values", ToastValues>>
>;

/**
 * The copy of a toast that names a message which interpolates a value, so
 * `values` fills its placeholders and is required.
 */
type ValuedCopy = Readonly<
  Record<"title", ToastTitleKey> &
    Partial<Record<"description", ToastDescriptionKey>> &
    Record<"values", ToastValues>
>;

/**
 * The copy of one toast. Every text is a key of the `Toast` namespace, so a
 * caller cannot pass text that the Toaster does not translate, and the copy
 * test measures every message. A title alone is the normal case: a description
 * is optional. A message with a placeholder needs `values`, so a copy that names
 * one without them does not compile. The keys are derived from the dictionary,
 * so the copy is built from `Record` types rather than written as an object
 * literal type.
 */
export type ToastCopy = PlainCopy | ValuedCopy;

/**
 * The options of a toast: its place, its length, its id, and an action. The
 * label of the action is a key of the `Toast` namespace that takes no values,
 * because a button has no copy to fill.
 */
type ToastOptions = Pick<ExternalToast, "duration" | "id" | "position"> & {
  readonly action?: {
    readonly label: Exclude<ToastTitleKey, ToastValueKey>;
    readonly onClick: () => void;
  };
};

/**
 * The one way the app shows a toast. The helper hands Sonner the keys and their
 * values as nodes, and the Toaster renders each one in the reader's language
 * (see `components/ui/sonner.tsx`). The title takes one line and the
 * description at most two, which the Toaster clamps.
 */
export const toast = {
  /** Shows a toast that reports a failure. */
  error: (copy: ToastCopy, options?: ToastOptions) =>
    sonner.error(titleNode(copy), dataOf(copy, options)),
  /** Shows a toast that reports information. */
  info: (copy: ToastCopy, options?: ToastOptions) =>
    sonner.info(titleNode(copy), dataOf(copy, options)),
  /** Shows a toast that reports success. */
  success: (copy: ToastCopy, options?: ToastOptions) =>
    sonner.success(titleNode(copy), dataOf(copy, options)),
  /** Closes the toast with this id, or every toast when no id is given. */
  dismiss: (id?: string | number) => sonner.dismiss(id),
};

/**
 * A message node: the Toaster renders its key in the reader's language, with its
 * values when the message takes them.
 */
function messageNode(
  message: ToastTitleKey | ToastDescriptionKey,
  values?: ToastValues
) {
  return createElement(ToastMessage, { message, values });
}

/** The title that Sonner shows for a copy. */
function titleNode(copy: ToastCopy) {
  return messageNode(copy.title, copy.values);
}

/** The Sonner options of a copy: its description and its action, each as a message node. */
function dataOf(copy: ToastCopy, options: ToastOptions = {}): ExternalToast {
  const { action, ...rest } = options;
  return {
    ...rest,
    action:
      action === undefined
        ? undefined
        : {
            label: messageNode(action.label),
            onClick: action.onClick,
          },
    description:
      copy.description === undefined
        ? undefined
        : messageNode(copy.description, copy.values),
  };
}
