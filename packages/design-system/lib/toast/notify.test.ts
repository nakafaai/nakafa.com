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
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast as sonner } from "sonner";
import { IntlProvider } from "use-intl";

const sonnerModule = vi.hoisted(() => ({
  toast: Object.assign(
    vi.fn(() => "shown"),
    {
      dismiss: vi.fn(),
      error: vi.fn(() => "failed"),
      info: vi.fn(() => "info"),
      success: vi.fn(() => "done"),
    }
  ),
}));

vi.mock("@repo/analytics/posthog/capture", () => ({
  captureException: vi.fn(),
}));

vi.mock("sonner", () => sonnerModule);

afterEach(() => vi.clearAllMocks());

describe("toast", () => {
  // The first toast starts loading Sonner, and the calls made before it run once it
  // has loaded. Waiting for that once keeps every later toast synchronous.
  beforeAll(async () => {
    toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(sonner.info).toHaveBeenCalled());
    vi.clearAllMocks();
  });

  it("hands Sonner the keys of the title and the description, with the place and id it is given", () => {
    toast.error(
      { title: "action-error.title", description: "action-error.description" },
      { id: "save", position: "bottom-center" }
    );

    expect(sonner.error).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, { message: "action-error.title" }),
      {
        description: createElement(ToastMessage, {
          message: "action-error.description",
        }),
        id: "save",
        position: "bottom-center",
      }
    );
  });

  it("hands the values of the copy to the title and the description, so the placeholders fill", () => {
    toast.error({
      description: "failure-attachment-size.description",
      title: "failure-attachment-size.title",
      values: { size: 10 },
    });

    expect(sonner.error).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, {
        message: "failure-attachment-size.title",
        values: { size: 10 },
      }),
      {
        description: createElement(ToastMessage, {
          message: "failure-attachment-size.description",
          values: { size: 10 },
        }),
      }
    );
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

    expect(sonner.success).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, { message: "copy-success.title" }),
      { description: undefined }
    );
  });

  it("shows information with its own kind, not as a failure", () => {
    toast.info({ title: "copy-success.title" });

    expect(sonner.info).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, { message: "copy-success.title" }),
      { description: undefined }
    );
    expect(sonner.error).not.toHaveBeenCalled();
  });

  it("passes an action on with its label as a word of Common, so the Toaster shows it as a button", () => {
    const onClick = vi.fn();

    toast.error(
      { title: "action-error.title" },
      { action: { label: "undo", onClick }, duration: 5000 }
    );

    expect(sonner.error).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, { message: "action-error.title" }),
      {
        action: {
          label: createElement(ToastAction, { label: "undo" }),
          onClick,
        },
        description: undefined,
        duration: 5000,
      }
    );
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

  it("closes the toast with the id it is given, or every toast without one", () => {
    toast.dismiss("shown");
    toast.dismiss();

    expect(sonner.dismiss).toHaveBeenNthCalledWith(1, "shown");
    expect(sonner.dismiss).toHaveBeenNthCalledWith(2, undefined);
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

  it("holds the toasts made before Sonner loads, and shows them in the order they were made", async () => {
    const notify = await loadFreshNotify();
    const { toast: sonnerToast } = await import("sonner");
    notify.toast.success({ title: "action-error.title" });
    notify.toast.error({ title: "action-error.title" });

    expect(sonnerToast.success).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(sonnerToast.error).toHaveBeenCalledOnce());
    expect(sonnerToast.success).toHaveBeenCalledOnce();
    expect(
      vi.mocked(sonnerToast.success).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(sonnerToast.error).mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY
    );
  });

  it("shows a toast at once once Sonner has loaded", async () => {
    const notify = await loadFreshNotify();
    const { toast: sonnerToast } = await import("sonner");
    notify.toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(sonnerToast.info).toHaveBeenCalledOnce());

    notify.toast.info({ title: "action-error.title" });

    expect(sonnerToast.info).toHaveBeenCalledTimes(2);
  });

  it("keeps the first held toasts when the wait overflows", async () => {
    const notify = await loadFreshNotify();
    const { toast: sonnerToast } = await import("sonner");
    Arr.forEach(
      Arr.makeBy(25, (index) => index),
      (index) =>
        notify.toast.info(
          { title: "action-error.title" },
          { id: `id-${index}` }
        )
    );

    await vi.waitFor(() => expect(sonnerToast.info).toHaveBeenCalledTimes(20));
    expect(sonnerToast.info).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ id: "id-0" })
    );
    expect(sonnerToast.info).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "id-19" })
    );
  });

  it.effect("does not load Sonner for a dismiss before any toast", () =>
    Effect.gen(function* () {
      const sonnerLoads = vi.fn(() => sonnerModule);
      vi.doMock("sonner", sonnerLoads);
      const notify = yield* Effect.promise(() => loadFreshNotify());
      const listener = vi.fn();
      notify.subscribeToastRequests(listener);

      notify.toast.dismiss("first");
      yield* Effect.yieldNow;

      expect(sonnerLoads).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
      expect(notify.isToastRequested()).toBe(false);

      // A toast request loads the same mock, so the spy above proves the absence.
      notify.toast.info({ title: "action-error.title" });
      yield* Effect.promise(() =>
        vi.waitFor(() => expect(sonnerLoads).toHaveBeenCalledOnce())
      );
    })
  );

  it("loads Sonner again on the next toast after a failed load, and shows the held toasts then", async () => {
    vi.doMock("sonner", () =>
      Promise.reject(new Error("The Sonner chunk failed to load."))
    );
    const notify = await loadFreshNotify();
    const { captureException } = await import(
      "@repo/analytics/posthog/capture"
    );
    const listener = vi.fn();
    notify.subscribeToastRequests(listener);

    notify.toast.info({ title: "action-error.title" });
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledOnce());

    vi.doMock("sonner", () => sonnerModule);
    notify.toast.info({ title: "copy-success.title" });

    await vi.waitFor(() =>
      expect(sonnerModule.toast.info).toHaveBeenCalledTimes(2)
    );
    expect(captureException).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      { source: "toast-load" }
    );
    expect(listener).toHaveBeenCalledOnce();
  });
});
