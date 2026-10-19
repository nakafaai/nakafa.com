import {
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "@effect/vitest";
import { ToastMessage } from "@repo/design-system/lib/toast/message";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect } from "effect";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast as sonner } from "sonner";

vi.mock("sonner", () => ({
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

afterEach(() => vi.clearAllMocks());

describe("toast", () => {
  // The first toast starts loading Sonner, and the calls made before it run once it
  // has loaded. Waiting for that once keeps every later toast synchronous.
  beforeAll(async () => {
    toast.dismiss();
    await vi.waitFor(() => expect(sonner.dismiss).toHaveBeenCalled());
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

  it("passes an action on with its label as a key, so the Toaster shows it as a button", () => {
    const onClick = vi.fn();

    toast.error(
      { title: "action-error.title" },
      { action: { label: "copy-success.title", onClick }, duration: 5000 }
    );

    expect(sonner.error).toHaveBeenCalledExactlyOnceWith(
      createElement(ToastMessage, { message: "action-error.title" }),
      {
        action: {
          label: createElement(ToastMessage, {
            message: "copy-success.title",
          }),
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
          createElement(NextIntlClientProvider, {
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
    notify.toast.dismiss("first");
    notify.toast.dismiss("second");

    expect(notify.isToastRequested()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops telling a listener that unsubscribed", async () => {
    const notify = await loadFreshNotify();
    const listener = vi.fn();
    notify.subscribeToastRequests(listener)();

    notify.toast.dismiss("first");

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
      (index) => notify.toast.dismiss(`id-${index}`)
    );

    await vi.waitFor(() =>
      expect(sonnerToast.dismiss).toHaveBeenCalledTimes(20)
    );
    expect(sonnerToast.dismiss).toHaveBeenNthCalledWith(1, "id-0");
    expect(sonnerToast.dismiss).toHaveBeenLastCalledWith("id-19");
  });
});
