import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Schema } from "effect";

/** The English messages of the Toast namespace, from which every toast key is derived. */
type ToastMessages = typeof en.Toast;

/**
 * A key of a toast title, such as `action-error.title`. Each entry of the
 * namespace has a title, so each entry gives one key.
 */
export type ToastTitleKey = {
  [Name in keyof ToastMessages]: ToastMessages[Name] extends { title: string }
    ? `${Name & string}.title`
    : never;
}[keyof ToastMessages];

/**
 * The key of a toast's action: a plain message of the `Common` namespace, which owns the app's verbs such as Open
 * and Undo, so no toast's own copy repeats one.
 */
export type ToastActionKey = {
  [Name in keyof typeof en.Common]: (typeof en.Common)[Name] extends string
    ? Name
    : never;
}[keyof typeof en.Common];

/** A key of a toast description, such as `action-error.description`, for each entry that has one. */
export type ToastDescriptionKey = {
  [Name in keyof ToastMessages]: ToastMessages[Name] extends {
    description: string;
  }
    ? `${Name & string}.description`
    : never;
}[keyof ToastMessages];

/**
 * The values a toast message interpolates, by the name of its placeholder. The
 * test in `toast.test.ts` checks that every placeholder of the dictionary is
 * named here.
 */
export const ToastValuesSchema = Schema.Struct({ size: Schema.Finite });
/** The values of one toast message, which the Toaster passes to the locale seam. */
export type ToastValues = typeof ToastValuesSchema.Type;

/**
 * The keys of the toast messages that interpolate a value, such as the size in
 * `failure-attachment-size.description`. A copy that names one of them must pass
 * its values, and the type of the copy checks it. The dictionaries are JSON,
 * whose types hold no placeholders, so `toast.test.ts` checks this list against
 * the placeholders of every locale.
 */
export const ToastValueKeySchema = Schema.Literals([
  "failure-attachment-size.description",
]);
/** A key of a toast message that interpolates a value, so its copy must pass the values. */
export type ToastValueKey = typeof ToastValueKeySchema.Type;
