import { afterEach, describe, expect, it } from "@effect/vitest";
import { ToastMessage } from "@repo/design-system/lib/toast/message";
import { toast } from "@repo/design-system/lib/toast/notify";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
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
