import {
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "@effect/vitest";
import {
  ToastAction,
  ToastMessage,
} from "@repo/design-system/lib/toast/message";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { toast } from "@repo/design-system/lib/toast/notify";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

const toastModule = vi.hoisted(() => {
  /** One queue of the Toaster, with a spy for each call the helper makes. */
  const queue = () => ({
    dismiss: vi.fn(),
    error: vi.fn(() => "failed"),
    info: vi.fn(() => "info"),
    success: vi.fn(() => "done"),
  });
  return {
    toasters: {
      "bottom-center": queue(),
      "bottom-end": queue(),
      "top-center": queue(),
    },
  };
});

const queue = toastModule.toasters["bottom-end"];
const centered = toastModule.toasters["bottom-center"];
const top = toastModule.toasters["top-center"];

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: vi.fn(),
}));

vi.mock("@repo/design-system/components/ui/toast", () => toastModule);

afterEach(() => vi.clearAllMocks());

describe("toast", () => {
  // The first toast starts loading the Toaster, and the calls made before it run once
  // it has loaded. Waiting for that once keeps every later toast synchronous.
  beforeAll(async () => {
    toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(queue.info).toHaveBeenCalled());
    vi.clearAllMocks();
  });

  it("hands the Toaster the keys of the title and the description, with the id it is given", () => {
    toast.error(
      { title: "action-error.title", description: "action-error.description" },
      { id: "save" }
    );

    expect(queue.error).toHaveBeenCalledExactlyOnceWith({
      description: createElement(ToastMessage, {
        message: "action-error.description",
      }),
      id: "save",
      title: createElement(ToastMessage, { message: "action-error.title" }),
    });
    expect(centered.error).not.toHaveBeenCalled();
  });

  it("shows a toast that asks for the bottom center in the centered stack, and only there", () => {
    toast.success(
      { title: "copy-success.title" },
      { position: "bottom-center" }
    );

    expect(centered.success).toHaveBeenCalledExactlyOnceWith({
      title: createElement(ToastMessage, { message: "copy-success.title" }),
    });
    expect(queue.success).not.toHaveBeenCalled();
  });

  it("shows a toast that asks for the top center there, clear of a composer at the bottom", () => {
    toast.error({ title: "action-error.title" }, { position: "top-center" });

    expect(top.error).toHaveBeenCalledExactlyOnceWith({
      title: createElement(ToastMessage, { message: "action-error.title" }),
    });
    expect(queue.error).not.toHaveBeenCalled();
  });

  it("hands the values of the copy to the title and the description, so the placeholders fill", () => {
    toast.error({
      description: "failure-attachment-size.description",
      title: "failure-attachment-size.title",
      values: { size: 10 },
    });

    expect(queue.error).toHaveBeenCalledExactlyOnceWith({
      description: createElement(ToastMessage, {
        message: "failure-attachment-size.description",
        values: { size: 10 },
      }),
      title: createElement(ToastMessage, {
        message: "failure-attachment-size.title",
        values: { size: 10 },
      }),
    });
  });

  it("takes a message that interpolates only with the values that fill it", () => {
    expectTypeOf<{
      description: "failure-attachment-size.description";
      title: "failure-attachment-size.title";
    }>().not.toExtend<ToastCopy>();
    expectTypeOf<{
      description: "failure-attachment-size.description";
      title: "failure-attachment-size.title";
      values: { size: number };
    }>().toExtend<ToastCopy>();
  });

  it("shows a title alone, with no description", () => {
    toast.success({ title: "copy-success.title" });

    expect(queue.success).toHaveBeenCalledExactlyOnceWith({
      title: createElement(ToastMessage, { message: "copy-success.title" }),
    });
  });

  it("shows information with its own kind, not as a failure", () => {
    toast.info({ title: "copy-success.title" });

    expect(queue.info).toHaveBeenCalledExactlyOnceWith({
      title: createElement(ToastMessage, { message: "copy-success.title" }),
    });
    expect(queue.error).not.toHaveBeenCalled();
  });

  it("passes an action on with its label as a word of Common, so the Toaster shows it as a button", () => {
    const onClick = vi.fn();

    toast.error(
      { title: "action-error.title" },
      { action: { label: "undo", onClick }, duration: 5000 }
    );

    expect(queue.error).toHaveBeenCalledExactlyOnceWith({
      action: {
        label: createElement(ToastAction, { label: "undo" }),
        onAction: onClick,
      },
      duration: 5000,
      title: createElement(ToastMessage, { message: "action-error.title" }),
    });
  });

  it.effect(
    "renders each key in the reader's language, from the Toast namespace of the dictionary",
    () =>
      Effect.gen(function* () {
        const messages = yield* Effect.promise(() => loadLocaleMessages("de"));
        const markup = renderToStaticMarkup(
          createElement(IntlProvider, {
            // The provider's props type requires its children, so the node goes there.
            // biome-ignore lint/correctness/noChildrenProp: the provider's props type requires children
            children: createElement(ToastMessage, {
              message: "failure-attachment-size.description",
              values: { size: 10 },
            }),
            locale: "de",
            messages,
          })
        );

        // The number keeps its unit on one line with a no-break space.
        expect(markup).toBe("Zusammen höchstens 10 MiB pro Nachricht.");
      })
  );

  it.effect(
    "renders an action's label in the reader's language, from the Common namespace of the dictionary",
    () =>
      Effect.gen(function* () {
        const messages = yield* Effect.promise(() => loadLocaleMessages("de"));
        const markup = renderToStaticMarkup(
          createElement(IntlProvider, {
            // The provider's props type requires its children, so the node goes there.
            // biome-ignore lint/correctness/noChildrenProp: the provider's props type requires children
            children: createElement(ToastAction, { label: "undo" }),
            locale: "de",
            messages,
          })
        );

        expect(markup).toBe("Rückgängig");
      })
  );

  it("closes the toast with the id it is given, or every toast without one, in both stacks", () => {
    toast.dismiss("shown");
    toast.dismiss();

    expect(queue.dismiss).toHaveBeenNthCalledWith(1, "shown");
    expect(queue.dismiss).toHaveBeenNthCalledWith(2, undefined);
    expect(centered.dismiss).toHaveBeenNthCalledWith(1, "shown");
    expect(centered.dismiss).toHaveBeenNthCalledWith(2, undefined);
    expect(top.dismiss).toHaveBeenNthCalledWith(1, "shown");
    expect(top.dismiss).toHaveBeenNthCalledWith(2, undefined);
  });
});

describe("the first toast", () => {
  /** Loads a fresh helper, so the test starts before any toast was shown. */
  function loadFreshNotify() {
    vi.resetModules();
    return import("@repo/design-system/lib/toast/notify");
  }

  it("asks for the Toaster once, on the first toast, and tells each listener", async () => {
    const notify = await loadFreshNotify();
    const listener = vi.fn();
    notify.subscribeToastRequests(listener);

    expect(notify.isToastRequested()).toBe(false);
    notify.toast.info({ title: "action-error.title" });
    notify.toast.info({ title: "action-error.title" });

    expect(notify.isToastRequested()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops telling a listener that unsubscribed", async () => {
    const notify = await loadFreshNotify();
    const listener = vi.fn();
    notify.subscribeToastRequests(listener)();

    notify.toast.info({ title: "action-error.title" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("holds the toasts made before the Toaster loads, and shows them in the order they were made", async () => {
    const notify = await loadFreshNotify();
    const {
      toasters: { "bottom-end": endQueue },
    } = await import("@repo/design-system/components/ui/toast");
    notify.toast.success({ title: "action-error.title" });
    notify.toast.error({ title: "action-error.title" });

    expect(endQueue.success).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(endQueue.error).toHaveBeenCalledOnce());
    expect(endQueue.success).toHaveBeenCalledOnce();
    expect(
      vi.mocked(endQueue.success).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(endQueue.error).mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY
    );
  });

  it("shows a toast at once once the Toaster has loaded", async () => {
    const notify = await loadFreshNotify();
    const {
      toasters: { "bottom-end": endQueue },
    } = await import("@repo/design-system/components/ui/toast");
    notify.toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(endQueue.info).toHaveBeenCalledOnce());

    notify.toast.info({ title: "action-error.title" });

    expect(endQueue.info).toHaveBeenCalledTimes(2);
  });

  it("keeps the first held toasts when the wait overflows", async () => {
    const notify = await loadFreshNotify();
    const {
      toasters: { "bottom-end": endQueue },
    } = await import("@repo/design-system/components/ui/toast");
    Arr.forEach(
      Arr.makeBy(25, (index) => index),
      (index) =>
        notify.toast.info(
          { title: "action-error.title" },
          { id: `id-${index}` }
        )
    );

    await vi.waitFor(() => expect(endQueue.info).toHaveBeenCalledTimes(20));
    expect(endQueue.info).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: "id-0" })
    );
    expect(endQueue.info).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "id-19" })
    );
  });

  it.effect("does not load the Toaster for a dismiss before any toast", () =>
    Effect.gen(function* () {
      const toasterLoads = vi.fn(() => toastModule);
      vi.doMock("@repo/design-system/components/ui/toast", toasterLoads);
      const notify = yield* Effect.promise(() => loadFreshNotify());
      const listener = vi.fn();
      notify.subscribeToastRequests(listener);

      notify.toast.dismiss("first");
      yield* Effect.yieldNow;

      expect(toasterLoads).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
      expect(notify.isToastRequested()).toBe(false);

      // A toast request loads the same mock, so the spy above proves the absence.
      notify.toast.info({ title: "action-error.title" });
      yield* Effect.promise(() =>
        vi.waitFor(() => expect(toasterLoads).toHaveBeenCalledOnce())
      );
    })
  );

  it("loads the Toaster again on the next toast after a failed load, and shows the held toasts then", async () => {
    vi.doMock("@repo/design-system/components/ui/toast", () =>
      Promise.reject(new Error("The Toaster chunk failed to load."))
    );
    const notify = await loadFreshNotify();
    const { captureException } = await import(
      "@repo/analytics/posthog/capture"
    );
    const listener = vi.fn();
    notify.subscribeToastRequests(listener);

    notify.toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());

    vi.doMock("@repo/design-system/components/ui/toast", () => toastModule);
    notify.toast.info({ title: "copy-success.title" });

    await vi.waitFor(() =>
      expect(toastModule.toasters["bottom-end"].info).toHaveBeenCalledTimes(2)
    );
    expect(captureException).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      { source: "toast-load" }
    );
    expect(listener).toHaveBeenCalledOnce();
  });
});
