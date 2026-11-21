import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { inspectPaneFooters } from "#scripts/check/footers";
import { parseSources } from "#scripts/check/source";

const PANE_FILE = "apps/www/src/components/shared/page/pane.tsx";
const TOOLS_FILE = "apps/www/src/components/player/navigator/tools.tsx";
const SIDEBAR_FILE = "apps/www/src/components/player/navigator/sidebar.tsx";
const SHEET_FILE = "apps/www/src/components/player/navigator/sheet.tsx";
const CALLER_FILE = "apps/www/src/components/feature/page.tsx";

const CLEAN_PANE = `export function PaneFooter({ children }: { children: unknown }) {
  return <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t">{children}</footer>;
}
`;

const CLEAN_TOOLS = `import { PaneFooter } from "@/components/shared/page/pane";
export function PlayerTools({ children }: { children: unknown }) {
  return <PaneFooter>{children}</PaneFooter>;
}
`;

const CLEAN_SIDEBAR = `import { PlayerTools } from "@/components/player/navigator/tools";
export function PlayerSidebar({ footer }: { footer?: unknown }) {
  return <PlayerTools>{footer}</PlayerTools>;
}
`;

const CLEAN_SHEET = `import { PlayerTools } from "@/components/player/navigator/tools";
export function PlayerSheet({ footer }: { footer?: unknown }) {
  return <PlayerTools>{footer}</PlayerTools>;
}
`;

const run = (files: Parameters<typeof parseSources>[0]) =>
  Effect.scoped(
    Effect.map(parseSources(files), ({ modules }) =>
      inspectPaneFooters(modules)
    )
  );

describe("the pane footer policy", () => {
  it.effect(
    "accepts single-row pane footers with controls and portal dialogs",
    () =>
      Effect.gen(function* () {
        const findings = yield* run([
          { file: PANE_FILE, sourceText: CLEAN_PANE },
          { file: TOOLS_FILE, sourceText: CLEAN_TOOLS },
          { file: SIDEBAR_FILE, sourceText: CLEAN_SIDEBAR },
          { file: SHEET_FILE, sourceText: CLEAN_SHEET },
          {
            file: CALLER_FILE,
            sourceText: `import { PaneFooter } from "@/components/shared/page/pane";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerSheet } from "@/components/player/navigator/sheet";

function ConfirmDialog() {
  return <div className="flex flex-wrap"><p>Dialog prose is allowed inside overlays.</p></div>;
}

function ActionButton() {
  return (
    <>
      <button type="button">Start</button>
      <ConfirmDialog />
    </>
  );
}

export function Page() {
  return (
    <div>
      <PaneFooter>
        <ActionButton />
        <Namespace.Control />
        <svg:rect />
      </PaneFooter>
      <PlayerSidebar footer={<ActionButton />} />
      <PlayerSheet />
    </div>
  );
}
`,
          },
        ]);
        expect(findings).toEqual([]);
      })
  );

  it.effect("rejects flex-wrap on PaneFooter itself", () =>
    Effect.gen(function* () {
      const findings = yield* run([
        {
          file: PANE_FILE,
          sourceText: `export function PaneFooter({ children }: { children: unknown }) {
  return <footer className="flex min-h-16 flex-wrap items-center">{children}</footer>;
}
`,
        },
      ]);
      expect(findings).toEqual([
        `${PANE_FILE}:2: a pane footer stays on one row; remove flex-wrap.`,
      ]);
    })
  );

  it.effect(
    "rejects prose and flex-wrap inside PaneFooter, PlayerTools, and player footer props",
    () =>
      Effect.gen(function* () {
        const findings = yield* run([
          { file: PANE_FILE, sourceText: CLEAN_PANE },
          { file: TOOLS_FILE, sourceText: CLEAN_TOOLS },
          { file: SIDEBAR_FILE, sourceText: CLEAN_SIDEBAR },
          { file: SHEET_FILE, sourceText: CLEAN_SHEET },
          {
            file: CALLER_FILE,
            sourceText: `import { PaneFooter } from "@/components/shared/page/pane";
import { PlayerSidebar } from "@/components/player/navigator/sidebar";
import { PlayerSheet } from "@/components/player/navigator/sheet";

function RestartHelper() {
  return (
    <>
      <p>Start again to clear every check.</p>
      <button type="button">Start again</button>
    </>
  );
}

function WrappingStatus() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>Online</span>
    </div>
  );
}

function LoopA() {
  return <LoopB />;
}

function LoopB() {
  return <LoopA />;
}

export function Page() {
  return (
    <div>
      <PaneFooter>
        <WrappingStatus />
        <h2>Heading</h2>
        <LoopA />
      </PaneFooter>
      <PlayerSidebar footer={<RestartHelper />} />
      <PlayerSheet footer={<RestartHelper />} />
    </div>
  );
}
`,
          },
        ]);
        expect(findings).toEqual([
          `${CALLER_FILE}:16: a pane footer stays on one row; remove flex-wrap.`,
          `${CALLER_FILE}:35: a pane footer holds controls alone, never prose <h2>.`,
          `${CALLER_FILE}:8: a pane footer holds controls alone, never prose <p>.`,
        ]);
      })
  );

  it.effect("ignores unrelated components that reuse the same tag name", () =>
    Effect.gen(function* () {
      const findings = yield* run([
        {
          file: CALLER_FILE,
          sourceText: `function PaneFooter({ children }: { children: unknown }) {
  return <div>{children}</div>;
}

export function Page() {
  return (
    <PaneFooter>
      <p>Not the shared PaneFooter.</p>
    </PaneFooter>
  );
}
`,
        },
      ]);
      expect(findings).toEqual([]);
    })
  );
});
