import { captureException } from "@repo/analytics/posthog/capture";
import {
  ToastAction,
  ToastMessage,
} from "@repo/design-system/lib/toast/message";
import type {
  ToastActionKey,
  ToastDescriptionKey,
  ToastTitleKey,
  ToastValueKey,
  ToastValues,
} from "@repo/internationalization/src/toast";
import { Array as Arr, Effect, MutableRef, Schema } from "effect";
import { createElement } from "react";
import type { ExternalToast, toast as SonnerToast } from "sonner";

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
 * label of the action is one word of the `Common` namespace, such as `undo`,
 * which owns the app's verbs, so no toast's own copy repeats it.
 */
type ToastOptions = Pick<ExternalToast, "duration" | "id" | "position"> & {
  readonly action?: {
    readonly label: ToastActionKey;
    readonly onClick: () => void;
  };
};

/** One call of the Sonner toast function, held until the library has loaded. */
type ToastSend = (sonner: typeof SonnerToast) => void;

/** Calls held before the library loads. A load that never completes stops the queue here. */
const PENDING_TOAST_LIMIT = 20;

/** Raised when the Sonner library cannot load. The held calls wait for the next toast to load it again. */
class ToastLoadFailed extends Schema.TaggedError<ToastLoadFailed>()(
  "ToastLoadFailed",
  { cause: Schema.Unknown }
) {}

const toastRequested = MutableRef.make(false);
const sonnerLoading = MutableRef.make(false);
const toastListeners = MutableRef.make<readonly (() => void)[]>([]);
const loadedToast = MutableRef.make<typeof SonnerToast | undefined>(undefined);
const pendingSends = MutableRef.make<readonly ToastSend[]>([]);

/** Reports whether a first toast has asked for the Toaster to mount. */
export function isToastRequested() {
  return MutableRef.get(toastRequested);
}

/** Registers a listener for the first toast request, and returns its unsubscribe. */
export function subscribeToastRequests(listener: () => void) {
  MutableRef.set(
    toastListeners,
    Arr.append(MutableRef.get(toastListeners), listener)
  );
  return () => {
    MutableRef.set(
      toastListeners,
      Arr.filter(
        MutableRef.get(toastListeners),
        (current) => current !== listener
      )
    );
  };
}

/**
 * Runs one toast call. The first call asks for the Toaster to mount and loads
 * Sonner, and every call made before Sonner has loaded runs once it has, in the
 * order it was made. Sonner keeps the toasts it receives until a Toaster
 * subscribes, so a toast shown before the mount is not lost. A failed load keeps
 * the held calls, and the next call starts the load again.
 */
function requestToast(send: ToastSend) {
  const loaded = MutableRef.get(loadedToast);
  if (loaded) {
    send(loaded);
    return;
  }

  const pending = MutableRef.get(pendingSends);
  if (pending.length < PENDING_TOAST_LIMIT) {
    MutableRef.set(pendingSends, Arr.append(pending, send));
  }
  if (!MutableRef.get(toastRequested)) {
    MutableRef.set(toastRequested, true);
    Arr.forEach(MutableRef.get(toastListeners), (listener) => listener());
  }
  if (!MutableRef.get(sonnerLoading)) {
    MutableRef.set(sonnerLoading, true);
    Effect.runFork(loadSonner);
  }
}

/** Hands the loaded toast function to every held call, then empties the queue. */
function publishToast(toast: typeof SonnerToast) {
  MutableRef.set(loadedToast, toast);
  Arr.forEach(MutableRef.get(pendingSends), (send) => send(toast));
  MutableRef.set(pendingSends, []);
}

/** Loads Sonner. A failed load is reported, and the next toast loads it again. */
const loadSonner = Effect.tryPromise({
  try: () => import("sonner"),
  catch: (cause) => new ToastLoadFailed({ cause }),
}).pipe(
  Effect.map((module) => module.toast),
  Effect.tap((toast) => Effect.sync(() => publishToast(toast))),
  Effect.catchTag("ToastLoadFailed", (error) =>
    Effect.sync(() => {
      MutableRef.set(sonnerLoading, false);
      captureException(error.cause, { source: "toast-load" });
    })
  )
);

/**
 * The one way the app shows a toast. The helper hands Sonner the keys and their
 * values as nodes, and the Toaster renders each one in the reader's language
 * (see `components/ui/sonner.tsx`). The title takes one line and the
 * description at most two, which the Toaster clamps.
 */
export const toast = {
  /** Shows a toast that reports a failure. */
  error: (copy: ToastCopy, options?: ToastOptions) =>
    requestToast((sonner) => {
      sonner.error(titleNode(copy), dataOf(copy, options));
    }),
  /** Shows a toast that reports information. */
  info: (copy: ToastCopy, options?: ToastOptions) =>
    requestToast((sonner) => {
      sonner.info(titleNode(copy), dataOf(copy, options));
    }),
  /** Shows a toast that reports success. */
  success: (copy: ToastCopy, options?: ToastOptions) =>
    requestToast((sonner) => {
      sonner.success(titleNode(copy), dataOf(copy, options));
    }),
  /**
   * Closes the toast with this id, or every toast when no id is given. Before any
   * toast was requested there is nothing to close, so no library loads for it.
   */
  dismiss: (id?: string | number) => {
    if (!isToastRequested()) {
      return;
    }
    requestToast((sonner) => {
      sonner.dismiss(id);
    });
  },
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
            label: createElement(ToastAction, { label: action.label }),
            onClick: action.onClick,
          },
    description:
      copy.description === undefined
        ? undefined
        : messageNode(copy.description, copy.values),
  };
}
