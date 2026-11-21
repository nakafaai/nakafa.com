import { captureException } from "@repo/analytics/posthog/capture";
import type { toasters as ToasterQueues } from "@repo/design-system/components/ui/toast";
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
import { Array as Arr, Effect, MutableRef, Record, Schema } from "effect";
import { createElement } from "react";

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
 * which owns the app's verbs, so no toast's own copy repeats it. A toast stands
 * at the bottom end of the screen, unless its page keeps its own controls
 * there and asks for the bottom or the top center.
 */
interface ToastOptions {
  readonly action?: {
    readonly label: ToastActionKey;
    readonly onClick: () => void;
  };
  readonly duration?: number;
  readonly id?: string;
  readonly position?: keyof Toasters;
}

/** The toast queues of the Toaster, one for each place a toast stands. */
type Toasters = typeof ToasterQueues;

/** One call of a toast queue, held until the Toaster module has loaded. */
type ToastSend = (toasters: Toasters) => void;

/** Calls held before the Toaster loads. A load that never completes stops the queue here. */
const PENDING_TOAST_LIMIT = 20;

/** Raised when the Toaster module cannot load. The held calls wait for the next toast to load it again. */
class ToastLoadFailed extends Schema.TaggedError<
  ToastLoadFailed,
  { readonly brand: unique symbol }
>()("ToastLoadFailed", { cause: Schema.Unknown }) {}

const toastRequested = MutableRef.make(false);
const toasterLoading = MutableRef.make(false);
const toastListeners = MutableRef.make<readonly (() => void)[]>([]);
const loadedToasters = MutableRef.make<Toasters | undefined>(undefined);
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
 * its module, and every call made before it has loaded runs once it has, in the
 * order it was made. A queue keeps the toasts it receives until its stack
 * mounts, so a toast shown before the mount is not lost. A failed load keeps
 * the held calls, and the next call starts the load again.
 */
function requestToast(send: ToastSend) {
  const loaded = MutableRef.get(loadedToasters);
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
  if (!MutableRef.get(toasterLoading)) {
    MutableRef.set(toasterLoading, true);
    Effect.runFork(loadToasters);
  }
}

/** Hands the loaded queues to every held call, then empties the wait. */
function publishToasters(toasters: Toasters) {
  MutableRef.set(loadedToasters, toasters);
  Arr.forEach(MutableRef.get(pendingSends), (send) => send(toasters));
  MutableRef.set(pendingSends, []);
}

/** Loads the Toaster module, the one the host mounts. A failed load is reported, and the next toast loads it again. */
const loadToasters = Effect.tryPromise({
  try: () => import("@repo/design-system/components/ui/toast"),
  catch: (cause) => new ToastLoadFailed({ cause }),
}).pipe(
  Effect.map((module) => module.toasters),
  Effect.tap((toasters) => Effect.sync(() => publishToasters(toasters))),
  Effect.catchTag("ToastLoadFailed", (error) =>
    Effect.sync(() => {
      MutableRef.set(toasterLoading, false);
      captureException(error.cause, { source: "toast-load" });
    })
  )
);

/** The kinds of toast the app shows, each a status the Toaster colors. */
type ToastKind = "error" | "info" | "success";

/** Shows one toast of a kind, in the queue of the place it asks for. */
function show(kind: ToastKind, copy: ToastCopy, options: ToastOptions = {}) {
  requestToast((toasters) => {
    toasters[options.position ?? "bottom-end"][kind](toastOf(copy, options));
  });
}

/**
 * The one way the app shows a toast. The helper hands the Toaster the keys and
 * their values as nodes, and the Toaster renders each one in the reader's
 * language (see `components/ui/toast.tsx`). The title takes one line and the
 * description at most two, which the Toaster clamps.
 */
export const toast = {
  /** Shows a toast that reports a failure. */
  error: (copy: ToastCopy, options?: ToastOptions) =>
    show("error", copy, options),
  /** Shows a toast that reports information. */
  info: (copy: ToastCopy, options?: ToastOptions) =>
    show("info", copy, options),
  /** Shows a toast that reports success. */
  success: (copy: ToastCopy, options?: ToastOptions) =>
    show("success", copy, options),
  /**
   * Closes the toast with this id, wherever it stands, or every toast when no
   * id is given. Before any toast was requested there is nothing to close, so
   * nothing loads for it.
   */
  dismiss: (id?: string) => {
    if (!isToastRequested()) {
      return;
    }
    requestToast((toasters) => {
      Arr.forEach(Record.values(toasters), (queue) => queue.dismiss(id));
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

/** The toast a copy and its options make: its title, description and action as message nodes. */
function toastOf(copy: ToastCopy, options: ToastOptions) {
  const { action, duration, id } = options;
  return {
    title: messageNode(copy.title, copy.values),
    ...(copy.description === undefined
      ? {}
      : { description: messageNode(copy.description, copy.values) }),
    ...(action === undefined
      ? {}
      : {
          action: {
            label: createElement(ToastAction, { label: action.label }),
            onAction: action.onClick,
          },
        }),
    ...(duration === undefined ? {} : { duration }),
    ...(id === undefined ? {} : { id }),
  };
}
