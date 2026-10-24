import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Duration, Effect, Result, Schema } from "effect";
import { useMemoryActions } from "@/components/user/settings/memory/actions";
import { reportMemoryFailure } from "@/components/user/settings/memory/failure";
import {
  draftOf,
  type Memory,
  type MemoryDraft,
} from "@/components/user/settings/memory/list";
import {
  createMemoryStore,
  type MemoryStore,
  type MemoryStoreApi,
} from "@/components/user/settings/memory/store";

/** The server's answer to the next change, which each test sets. */
const server = vi.hoisted(() => ({ answer: vi.fn() }));
/** The page store that the mocked page reads, a new one for each test. */
let store: MemoryStoreApi = createMemoryStore();

// The Confect mutation runs its optimistic change with no store, and the change
// itself is mocked: `optimistic.test.ts` tests it. This test is about what the
// action does with the server's answer.
vi.mock("@confect/react", () => ({
  useMutation: () => ({
    withOptimisticUpdate:
      (update: (local: unknown, args: unknown) => void) => (args: unknown) => {
        update(undefined, args);
        return server.answer(args);
      },
  }),
}));

vi.mock("@/components/user/settings/memory/optimistic", () => ({
  addToList: vi.fn(),
  clearList: vi.fn(),
  editInList: vi.fn(),
  pauseState: vi.fn(),
  removeFromList: vi.fn(),
}));

vi.mock("@/components/user/settings/memory/provider", () => ({
  useMemoryLatest: () => () => store.getState(),
  useMemoryPage: (selector: (state: MemoryStore) => unknown) =>
    selector(store.getState()),
}));

vi.mock("@/components/user/settings/memory/failure", () => ({
  reportMemoryFailure: vi.fn(),
}));

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));
const grade: MemoryDraft = { text: "Kelas 12", title: "Sekolah" };
const plan: MemoryDraft = { text: "A new memory", title: "" };

/** A stored memory written by Nina, with the fields a test changes spelled out. */
function stored(name: string, change: Partial<Memory> = {}): Memory {
  return {
    author: "nina",
    confirmedAt: 1000,
    createdAt: 500,
    id: memoryId(name),
    text: `Text of ${name}`,
    ...change,
  };
}

const first = stored("a");
const second = stored("b");

beforeEach(() => {
  vi.clearAllMocks();
  store = createMemoryStore();
  server.answer.mockResolvedValue(Result.succeed(undefined));
  vi.mocked(reportMemoryFailure).mockReturnValue(Effect.succeed(true));
});

describe("memory actions", () => {
  it("lets go of the words kept for a memory once the server deletes it, and keeps the others", async () => {
    store.getState().withhold(first.id, grade);
    store.getState().withhold(second.id, plan);
    const { remove } = useMemoryActions();

    remove(first);

    await vi.waitFor(() =>
      expect(store.getState().withheld).toEqual({ [second.id]: plan })
    );
  });

  it("keeps the words an editor held for a memory the server keeps, and opens the editor with them", async () => {
    store.getState().openEdit(first);
    store.getState().withhold(first.id, plan);
    server.answer.mockResolvedValue(Result.fail("refused"));
    const { remove } = useMemoryActions();

    remove(first, grade);

    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({
        deleted: null,
        draft: plan,
        open: true,
        target: first,
      })
    );
    expect(store.getState().withheld).toEqual({});
  });

  it("brings a memory back to the list when the server keeps it, with no editor to reopen", async () => {
    server.answer.mockResolvedValue(Result.fail("refused"));
    const { remove } = useMemoryActions();

    remove(second);

    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({ deleted: null, open: false })
    );
    expect(store.getState().withheld).toEqual({});
  });

  it("sends the deletion of a memory once, when the learner asks again for it", async () => {
    const { remove } = useMemoryActions();

    remove(first);
    remove(first);

    await vi.waitFor(() => expect(server.answer).toHaveBeenCalledOnce());
  });

  it("keeps the words of an editor on a memory the learner deleted, and saves nothing", () => {
    store.getState().forget(first.id);
    const { edit } = useMemoryActions();

    edit(first.id, plan);

    expect(store.getState().withheld).toEqual({ [first.id]: plan });
    expect(server.answer).not.toHaveBeenCalled();
  });

  it("tells the editor that a rewrite the server refused can be tried again", async () => {
    server.answer.mockResolvedValue(Result.fail("refused"));
    const failed = vi.fn();
    const { edit } = useMemoryActions();

    edit(first.id, plan, { failed });

    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledExactlyOnceWith(true)
    );
  });

  it("saves a rewrite with no callback to wait for", async () => {
    const { edit } = useMemoryActions();

    edit(first.id, plan);

    await vi.waitFor(() =>
      expect(server.answer).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ id: first.id })
      )
    );
  });

  it("shows a new memory at once and gives the editor the id the server stored it under", async () => {
    const storedId = memoryId("new");
    server.answer.mockResolvedValue(Result.succeed(storedId));
    const done = vi.fn();
    const { add } = useMemoryActions();

    add(plan, { done, failed: vi.fn() });

    await vi.waitFor(() =>
      expect(done).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ id: storedId, text: plan.text })
      )
    );
  });

  it("tells the editor that a new memory the server refused can be tried again", async () => {
    server.answer.mockResolvedValue(Result.fail("refused"));
    const failed = vi.fn();
    const { add } = useMemoryActions();

    add(plan, { done: vi.fn(), failed });

    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledExactlyOnceWith(true)
    );
  });

  it("sends a change of the pause and waits for no answer", async () => {
    const { pause } = useMemoryActions();

    pause(true);

    await vi.waitFor(() =>
      expect(server.answer).toHaveBeenCalledExactlyOnceWith({ paused: true })
    );
    expect(reportMemoryFailure).not.toHaveBeenCalled();
  });

  it("reports a change of the pause that the server refused", async () => {
    server.answer.mockResolvedValue(Result.fail("refused"));
    const { pause } = useMemoryActions();

    pause(false);

    await vi.waitFor(() => expect(reportMemoryFailure).toHaveBeenCalledOnce());
  });

  it("lets go of the words the editor held for its memory when the server deletes everything", async () => {
    store.getState().openEdit(first);
    store.getState().withhold(first.id, plan);
    const { clear } = useMemoryActions();

    clear();

    await vi.waitFor(() => expect(store.getState().withheld).toEqual({}));
  });

  it("brings every memory and the editor back when the server deletes nothing", async () => {
    store.getState().openEdit(first);
    server.answer.mockResolvedValue(Result.fail("refused"));
    const { clear } = useMemoryActions();

    clear();

    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({
        cleared: 0,
        deleted: null,
        draft: draftOf(first),
        open: true,
        target: first,
      })
    );
  });

  // A live clock: the test waits one real timer for the page to take in its answer.
  it.live(
    "deletes everything with no editor open, and lets go of no words",
    () =>
      Effect.gen(function* () {
        store.getState().withhold(second.id, plan);
        const { clear } = useMemoryActions();

        clear();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(server.answer).toHaveBeenCalledOnce())
        );
        // One timer later, the page has taken in the server's answer and the change it sent.
        yield* Effect.sleep(Duration.millis(1));

        expect(store.getState().withheld).toEqual({ [second.id]: plan });
      })
  );

  it("brings nothing back when the server deletes nothing and no editor is open", async () => {
    server.answer.mockResolvedValue(Result.fail("refused"));
    const { clear } = useMemoryActions();

    clear();

    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({
        cleared: 0,
        open: false,
        target: null,
      })
    );
  });
});
