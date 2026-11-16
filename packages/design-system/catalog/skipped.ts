import { Array as Arr, Schema } from "effect";

/** A design system module or folder that has no card of its own, and why. */
const Skip = Schema.Struct({ path: Schema.String, reason: Schema.String });

/**
 * Every design system module that no card shows, with the reason. The generator refuses a module that is neither a
 * card's source nor named here, and a name here that matches no module, so a new component gets a card or a
 * reason the day it lands.
 */
export const SKIPPED: readonly (typeof Skip.Type)[] = [
  {
    path: "components/ui/autocomplete",
    reason: "the searchable list the Picker card composes",
  },
  {
    path: "components/ui/avatar",
    reason: "the round frame the PersonAvatar card draws a person in",
  },
  {
    path: "components/ui/dialog",
    reason: "the dialog parts the ResponsiveDialog card composes",
  },
  {
    path: "components/ui/drawer",
    reason: "the drawer parts the ResponsiveDialog and Picker cards compose",
  },
  {
    path: "components/ui/marker",
    reason: "the marker the MarkedLine card stands beside its words",
  },
  {
    path: "components/ui/mention",
    reason: "the mention list of the editor, which shows inside it",
  },
  {
    path: "components/ui/sidebar-content",
    reason: "a part of the Sidebar card",
  },
  { path: "components/ui/sidebar-menu", reason: "a part of the Sidebar card" },
  {
    path: "components/ui/sidebar-provider",
    reason: "a part of the Sidebar card",
  },
  {
    path: "components/ui/sidebar-submenu",
    reason: "a part of the Sidebar card",
  },
  {
    path: "components/ui/error-boundary",
    reason: "plumbing that draws nothing of its own",
  },
  {
    path: "components/ui/hold",
    reason: "plumbing that holds a popup until its data is read",
  },
  {
    path: "components/ui/intersection",
    reason: "plumbing that reports when an element comes into view",
  },
  {
    path: "components/ui/settled",
    reason: "plumbing that waits for the page to settle",
  },
  {
    path: "components/ui/stage",
    reason: "plumbing behind every drawer, scaling the page back",
  },
  {
    path: "components/ui/staged",
    reason: "plumbing that counts the open drawers",
  },
  {
    path: "components/ui/scrollbar",
    reason: "the page's own scrollbar, drawn by the app shell",
  },
  {
    path: "components/ui/tailwind-indicator",
    reason: "a development aid, never shipped",
  },
  {
    path: "components/ui/toaster",
    reason:
      "the host that loads the Toaster card's component with the first toast",
  },
  { path: "components/visual/fact", reason: "a part of the VisualCard card" },
  { path: "components/visual/scene", reason: "a part of the VisualCard card" },
  { path: "components/visual/sketch", reason: "a part of the VisualCard card" },
  { path: "components/code", reason: "the parts the CodeBlock card composes" },
  {
    path: "components/ai/actions",
    reason: "the actions under Nina's answer, shown in the Message card",
  },
  {
    path: "components/ai/code",
    reason: "the code block of Nina's answer, a CodeBlock",
  },
  {
    path: "components/ai/files",
    reason: "the files a learner attaches, drawn by the Attachment card",
  },
  {
    path: "components/ai/mermaid",
    reason: "a diagram in Nina's answer, drawn by the content renderer",
  },
  {
    path: "components/ai/response",
    reason: "Nina's answer, drawn by the content renderer",
  },
  {
    path: "components/evilcharts/ui",
    reason: "the parts the chart cards compose",
  },
  {
    path: "components/evilcharts/charts/area",
    reason: "a part of the AreaChart card",
  },
  {
    path: "components/evilcharts/charts/bar",
    reason: "a part of the BarChart card",
  },
  {
    path: "components/evilcharts/charts/composed",
    reason: "a part of the ComposedChart card",
  },
  {
    path: "components/evilcharts/charts/line",
    reason: "a part of the LineChart card",
  },
  {
    path: "components/icons",
    reason: "brand marks of other services, drawn as they are",
  },
  {
    path: "components/logos",
    reason:
      "brand marks of other companies, such as AI model makers, drawn as they are",
  },
  {
    path: "components/nina",
    reason: "the frame, life and waking of the Nina card's figure",
  },
  {
    path: "components/markdown",
    reason:
      "the renderer of authored lessons, whose type and math the brand book sets",
  },
  {
    path: "components/editor",
    reason: "the exam editor, a full-screen tool of its own",
  },
  {
    path: "components/three",
    reason:
      "the 3D building blocks of lesson visuals, framed by the VisualCard card",
  },
  {
    path: "components/contents",
    reason:
      "the lesson visuals, one per lesson, each framed by the VisualCard card",
  },
];

/** Whether a skip names a module, by its own path or by a folder that holds it. */
function names(skip: typeof Skip.Type, module: string) {
  return module === skip.path || module.startsWith(`${skip.path}/`);
}

/**
 * The modules no card shows and no skip names, and the skips that name no module. Each one is a failure: a
 * component needs a card or a reason, and a reason outlives no component.
 */
export function uncovered(
  modules: readonly string[],
  sources: readonly string[]
) {
  const missing = Arr.filter(
    modules,
    (module) =>
      !(
        Arr.contains(sources, module) ||
        Arr.some(SKIPPED, (skip) => names(skip, module))
      )
  );
  const stale = Arr.filter(
    SKIPPED,
    (skip) => !Arr.some(modules, (module) => names(skip, module))
  );
  return [
    ...Arr.map(
      missing,
      (module) =>
        `${module} has no card. Add one in catalog/cards, or name it in catalog/skipped.ts with its reason.`
    ),
    ...Arr.map(
      stale,
      (skip) => `catalog/skipped.ts names ${skip.path}, which no module is.`
    ),
  ];
}
