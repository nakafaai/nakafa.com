import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { openPageToAgents } from "@repo/design-system/lib/agent";
import { Button } from "@ui-sdk/react/button";
import { Array as Arr, Option } from "effect";
import { act, createElement, Fragment } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

/** A tool as the page hands it to the browser's agent. */
interface RegisteredTool {
  readonly execute: (input: unknown) => unknown;
  readonly name: string;
}

/** The tools the page registered with the stand-in for the browser's WebMCP. */
let registered: RegisteredTool[] = [];
let container: HTMLDivElement;
let root: Root;
let withdraw: () => void;

/** The tool the page registered under `name`. */
function tool(name: string) {
  return Option.getOrThrow(
    Arr.findFirst(registered, (candidate) => candidate.name === name)
  );
}

beforeEach(() => {
  registered = [];
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: (definition: RegisteredTool) => {
        registered = Arr.append(registered, definition);
        return Promise.resolve();
      },
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  withdraw();
  Reflect.deleteProperty(document, "modelContext");
});

describe("openPageToAgents", () => {
  it("registers the tools that read the page and act on it", () => {
    withdraw = openPageToAgents();

    expect(Arr.map(registered, (registration) => registration.name)).toEqual([
      "act",
      "query",
      "snapshot",
    ]);
  });

  it("presses a control for the agent, and leaves a control marked for a person to the person", async () => {
    let saved = 0;
    let deleted = 0;
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement(
            Button,
            {
              onClick: () => {
                saved += 1;
              },
            },
            "Save"
          ),
          createElement(
            "section",
            null,
            createElement(
              Button,
              {
                onClick: () => {
                  deleted += 1;
                },
              },
              "Delete"
            )
          )
        )
      );
    });
    // The mark a dialog that asks first puts on its destructive action.
    container
      .querySelector("section")
      ?.setAttribute(
        "data-agent-confirm",
        "Deletes the class for every student"
      );
    withdraw = openPageToAgents();

    const pressed = await act(() =>
      tool("act").execute({ steps: [{ action: "press", ref: "Save" }] })
    );
    const refused = await act(() =>
      tool("act").execute({ steps: [{ action: "press", ref: "Delete" }] })
    );

    expect(pressed).toMatchObject({ ok: true });
    expect(refused).toMatchObject({ ok: false });
    expect(saved).toBe(1);
    expect(deleted).toBe(0);
  });
});
