import { describe, expect, it } from "@effect/vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { Array as Arr, Effect } from "effect";
import { collab, getVersion } from "prosemirror-collab";
import { statePort, versionOf, viewPort } from "@/lib/editor/port";
import { EditorClosed } from "@/lib/editor/session";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+", toDOM: () => ["div", 0] },
    paragraph: {
      content: "text*",
      group: "block",
      toDOM: () => ["p", 0],
    },
    text: { inline: true },
  },
});

/** An empty document with one paragraph, which every test starts from. */
const emptyDoc = () => schema.node("doc", null, [schema.node("paragraph")]);

/** A view that holds a state with a collab plugin at version 0, as the editor starts. */
const makeView = () =>
  new EditorView(document.createElement("div"), {
    state: EditorState.create({
      doc: emptyDoc(),
      plugins: [collab({ clientID: "start", version: 0 })],
      schema,
    }),
  });

describe("viewPort", () => {
  it.effect(
    "builds a fresh state at the session's version with one collab plugin",
    () =>
      Effect.gen(function* () {
        const view = makeView();
        const port = viewPort(view);

        const fresh = port.fresh({
          clientId: "a",
          doc: emptyDoc(),
          version: 3,
        });

        expect(getVersion(fresh)).toBe(3);
        expect(
          Arr.filter(
            fresh.plugins,
            (plugin) => plugin.spec.key === collab().spec.key
          )
        ).toHaveLength(1);
      })
  );

  it("keeps the other plugins of the view in a fresh state", () => {
    const marker = new Plugin({ key: new PluginKey("marker") });
    const view = new EditorView(document.createElement("div"), {
      state: EditorState.create({
        doc: emptyDoc(),
        plugins: [collab({ clientID: "start", version: 0 }), marker],
        schema,
      }),
    });
    const port = viewPort(view);

    const fresh = port.fresh({ clientId: "a", doc: emptyDoc(), version: 0 });

    expect(fresh.plugins).toContain(marker);
  });

  it.effect("applies a change only to the state it was built from", () =>
    Effect.gen(function* () {
      const view = makeView();
      const port = viewPort(view);
      const built = view.state;

      const applied = yield* port.dispatch(
        built,
        built.tr.insertText("first", 1)
      );
      expect(applied).toBe(true);
      expect(view.state.doc.textContent).toBe("first");

      const stale = view.state;
      view.updateState(
        EditorState.create({
          doc: emptyDoc(),
          plugins: [collab({ clientID: "start", version: 0 })],
          schema,
        })
      );
      const refused = yield* port.dispatch(
        stale,
        stale.tr.insertText("second", 1)
      );
      expect(refused).toBe(false);
      expect(view.state.doc.textContent).toBe("");
    })
  );

  it.effect(
    "replaces the state only while the view still holds the one it was built from",
    () =>
      Effect.gen(function* () {
        const view = makeView();
        const port = viewPort(view);
        const built = view.state;
        const next = port.fresh({ clientId: "a", doc: emptyDoc(), version: 2 });

        const replaced = yield* port.replace(built, next);
        expect(replaced).toBe(true);
        expect(view.state).toBe(next);

        const refused = yield* port.replace(built, built);
        expect(refused).toBe(false);
        expect(view.state).toBe(next);
      })
  );

  it.effect("reads the state the view holds now", () =>
    Effect.gen(function* () {
      const view = makeView();
      const port = viewPort(view);

      expect(yield* port.state).toBe(view.state);
      expect(port.schema).toBe(view.state.schema);
    })
  );

  it.effect("reads the version of the document a view holds", () =>
    Effect.gen(function* () {
      const view = makeView();
      expect(versionOf(view)).toBe(0);

      const port = viewPort(view);
      const next = port.fresh({ clientId: "a", doc: emptyDoc(), version: 5 });
      yield* port.replace(view.state, next);

      expect(versionOf(view)).toBe(5);
    })
  );

  it.effect(
    "fails a change with EditorClosed once the view is destroyed, never as applied or stale",
    () =>
      Effect.gen(function* () {
        const view = makeView();
        const port = viewPort(view);
        const built = view.state;
        view.destroy();

        const dispatched = yield* port
          .dispatch(built, built.tr.insertText("late", 1))
          .pipe(Effect.flip);
        const replaced = yield* port.replace(built, built).pipe(Effect.flip);

        expect(dispatched).toBeInstanceOf(EditorClosed);
        expect(replaced).toBeInstanceOf(EditorClosed);
      })
  );
});

describe("statePort", () => {
  const initialState = () =>
    EditorState.create({
      doc: emptyDoc(),
      plugins: [collab({ clientID: "start", version: 0 })],
      schema,
    });

  it.effect(
    "applies a change to the state it holds, and refuses a change built on another state",
    () =>
      Effect.gen(function* () {
        const port = yield* statePort(initialState());
        const built = yield* port.state;

        expect(
          yield* port.dispatch(built, built.tr.insertText("first", 1))
        ).toBe(true);
        expect((yield* port.state).doc.textContent).toBe("first");

        expect(
          yield* port.dispatch(built, built.tr.insertText("second", 1))
        ).toBe(false);
        expect((yield* port.state).doc.textContent).toBe("first");
      })
  );

  it.effect(
    "replaces its state only while it holds the one the replacement was built from",
    () =>
      Effect.gen(function* () {
        const port = yield* statePort(initialState());
        const built = yield* port.state;
        const next = port.fresh({ clientId: "a", doc: emptyDoc(), version: 2 });

        expect(yield* port.replace(built, next)).toBe(true);
        expect(yield* port.state).toBe(next);

        expect(yield* port.replace(built, built)).toBe(false);
        expect(yield* port.state).toBe(next);
      })
  );
});
