import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Effect, MutableRef, Option, Result, Schema, Struct } from "effect";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useChatRename } from "@/components/ai/chat/title";

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  toastError: vi.fn(),
  updateTitle: vi.fn(),
}));

vi.mock("@repo/design-system/lib/toast/notify", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("@/components/ai/chat/mutation", () => ({
  useUpdateChatTitleMutation: () => mocks.updateTitle,
}));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Effect.sync(() => mocks.report(error, properties)),
  };
});

type Rename = ReturnType<typeof useChatRename>;

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
const chat: ChatView = {
  _creationTime: 0,
  _id: chatId,
  threadId: "thread_1",
  title: "The limit of one over x",
  type: "study",
  updatedAt: 0,
  visibility: "private",
};

/** The hook as the page's last render left it. */
const latest = MutableRef.make<Option.Option<Rename>>(Option.none());

/** The hook as the page's last render left it. */
function hook() {
  return Option.getOrThrow(MutableRef.get(latest));
}

/**
 * A page shaped like the chat header: the box holds Cancel and Confirm, and it
 * stays in the page while it is hidden, as the header's Activity keeps it, so a
 * press on Cancel or Confirm leaves the focus on a control that hides with the
 * box. The title takes the box's place while the box is hidden. The chat's menu
 * trigger and a control the learner might choose are there too.
 */
function Probe(props: { chat: ChatView }) {
  const rename = useChatRename(props.chat);
  MutableRef.set(latest, Option.some(rename));
  return createElement(
    "main",
    null,
    createElement(
      "fieldset",
      { hidden: !rename.isEditing, ref: rename.boxRef },
      createElement("input", { ref: rename.inputRef }),
      createElement("button", {
        id: "cancel",
        onClick: rename.closeEditor,
        type: "button",
      }),
      createElement("button", {
        id: "confirm",
        onClick: rename.handleSave,
        type: "button",
      })
    ),
    createElement("h1", {
      hidden: rename.isEditing,
      ref: rename.titleRef,
      tabIndex: -1,
    }),
    createElement("button", {
      id: "menu",
      ref: rename.moreActions,
      type: "button",
    }),
    createElement("button", { id: "learner", type: "button" })
  );
}

let container: HTMLDivElement;
let root: Root;

/** The element of the page that the selector names. */
function element(selector: string) {
  return Option.getOrThrow(
    Option.fromNullishOr(container.querySelector<HTMLElement>(selector))
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Probe, { chat }));
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe("useChatRename", () => {
  it("opens the box with the title, and hands the focus to the box when the menu closes after a rename", () => {
    act(() => hook().handleEdit());

    expect(hook().isEditing).toBe(true);
    expect(hook().chatTitle).toBe(chat.title);
    expect(hook().menuFinalFocus).toBe(hook().inputRef);

    act(() => hook().onMenuOpenChange(false));
    expect(hook().menuFinalFocus).toBe(hook().inputRef);

    act(() => hook().onMenuOpenChange(true));
    expect(hook().menuFinalFocus).toBeUndefined();
  });

  it("opens the box empty for a chat that has no title yet", () => {
    const untitled: ChatView = Struct.omit(chat, ["title"]);
    act(() => {
      root.render(createElement(Probe, { chat: untitled }));
    });

    act(() => hook().handleEdit());

    expect(hook().chatTitle).toBe("");
  });

  it.effect(
    "saves a changed title, closes the box, and leaves the focus on the chat's menu",
    () =>
      Effect.gen(function* () {
        mocks.updateTitle.mockResolvedValue(Result.succeed(null));
        act(() => hook().handleEdit());
        act(() => hook().setChatTitle("  Limits of x  "));
        act(() => element("input").focus());

        act(() => hook().handleSave());

        expect(hook().isEditing).toBe(false);
        expect(document.activeElement).toBe(element("#menu"));
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(mocks.updateTitle).toHaveBeenCalledWith({
              chatId,
              title: "Limits of x",
            })
          )
        );
        // The save resumes once the server has answered. The runtime runs tasks
        // in the order they were scheduled, so a yield made now runs after that.
        yield* Effect.yieldNow;
        expect(mocks.toastError).not.toHaveBeenCalled();
      })
  );

  it("closes the box without a change when the title is the one the chat has", () => {
    act(() => hook().handleEdit());

    act(() => hook().handleSave());

    expect(hook().isEditing).toBe(false);
    expect(mocks.updateTitle).not.toHaveBeenCalled();
  });

  it("returns the focus to the chat's menu when Confirm saves from its own button, which hides with the box", () => {
    mocks.updateTitle.mockResolvedValue(Result.succeed(null));
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("Confirmed title"));
    act(() => element("#confirm").focus());

    act(() => element("#confirm").click());

    expect(hook().isEditing).toBe(false);
    expect(document.activeElement).toBe(element("#menu"));
  });

  it("returns the focus to the chat's menu when Cancel closes the box from its own button, which hides with the box", () => {
    act(() => hook().handleEdit());
    act(() => element("#cancel").focus());

    act(() => element("#cancel").click());

    expect(hook().isEditing).toBe(false);
    expect(document.activeElement).toBe(element("#menu"));
  });

  it("keeps the box open and sends nothing for a title that is blank", () => {
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("   "));

    act(() => hook().handleSave());

    expect(hook().isEditing).toBe(true);
    expect(mocks.updateTitle).not.toHaveBeenCalled();
  });

  it("brings the box back with the words and the focus when the server refuses the title", async () => {
    mocks.updateTitle.mockResolvedValue(
      Result.fail(new Error("Refused by the test."))
    );
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("Refused title"));
    act(() => element("input").focus());

    act(() => hook().handleSave());

    await act(async () => {
      await vi.waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith({
          description: "action-error.description",
          title: "action-error.title",
        })
      );
    });
    expect(hook().isEditing).toBe(true);
    expect(hook().chatTitle).toBe("Refused title");
    expect(document.activeElement).toBe(element("input"));
    expect(mocks.report).toHaveBeenCalledOnce();
  });

  it("keeps the focus a learner chose while the save was on its way, when the refusal brings the box back", async () => {
    let refuse: (answer: Result.Result<null, Error>) => void = () => undefined;
    mocks.updateTitle.mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve;
      })
    );
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("Held title"));
    act(() => element("input").focus());
    act(() => hook().handleSave());
    act(() => element("#learner").focus());

    await act(async () => {
      refuse(Result.fail(new Error("Refused by the test.")));
      await vi.waitFor(() =>
        expect(mocks.toastError).toHaveBeenCalledWith({
          description: "action-error.description",
          title: "action-error.title",
        })
      );
    });

    expect(hook().isEditing).toBe(true);
    expect(document.activeElement).toBe(element("#learner"));
  });

  it("does not bring the box back for a refusal that a newer save has replaced", async () => {
    // The first save waits for a refusal; the second save stays on its way.
    let refuseFirst: (answer: Result.Result<null, Error>) => void = () =>
      undefined;
    mocks.updateTitle
      .mockReturnValueOnce(
        new Promise((resolve) => {
          refuseFirst = resolve;
        })
      )
      .mockReturnValueOnce(new Promise(() => undefined));
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("First title"));
    act(() => element("input").focus());
    act(() => hook().handleSave());
    act(() => hook().handleEdit());
    act(() => hook().setChatTitle("Second title"));
    act(() => element("input").focus());
    act(() => hook().handleSave());
    await act(async () => {
      await vi.waitFor(() =>
        expect(mocks.updateTitle).toHaveBeenCalledTimes(2)
      );
    });
    expect(mocks.updateTitle).toHaveBeenNthCalledWith(1, {
      chatId,
      title: "First title",
    });

    await act(async () => {
      refuseFirst(Result.fail(new Error("Refused by the test.")));
      await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledOnce());
    });

    expect(hook().isEditing).toBe(false);
    expect(document.activeElement).toBe(element("#menu"));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
