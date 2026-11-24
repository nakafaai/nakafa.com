import { Schema } from "effect";

const SceneStageSchema = Schema.Literals(["drawn", "failed", "loading"]);
type SceneStage = typeof SceneStageSchema.Type;

const FrameloopSchema = Schema.Literals(["always", "demand", "never"]);
type ActiveFrameloop = typeof FrameloopSchema.Type;

/**
 * Calls back whenever an element of the page turns inert or interactive
 * again, such as the page behind a visual card shown full screen.
 */
export function subscribeToInert(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    attributeFilter: ["inert"],
    subtree: true,
  });
  return () => observer.disconnect();
}

/** Calls back whenever the browser tab switches between visible and hidden. */
export function subscribeToDocumentVisibility(
  onChange: () => void
): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Reads whether the current browser tab is hidden. */
export function readDocumentHidden(): boolean {
  return document.hidden;
}

/** Server snapshot for document visibility before hydration. */
export function readServerDocumentHidden(): boolean {
  return false;
}

/** Resolves the externally visible scene stage attribute from state and draw status. */
export function resolveVisibleStage(
  stage: SceneStage,
  drawn: boolean
): SceneStage {
  if (stage === "failed") {
    return "failed";
  }
  return drawn ? "drawn" : "loading";
}

/** Resolves the R3F frameloop mode for active, paused, static, and hidden canvases. */
export function resolveFrameloop(
  running: boolean,
  paced: boolean
): ActiveFrameloop {
  if (!running) {
    return "never";
  }
  return paced ? "always" : "demand";
}

/**
 * Listens for WebGL context loss and restoration on one renderer's canvas.
 * Always calls `event.preventDefault()` so the browser can restore the context,
 * and invokes `onLost` only when the loss was not triggered intentionally by
 * pool eviction or unmount cleanup.
 */
export function watchContextLoss(
  gl: { readonly domElement: EventTarget },
  callbacks: {
    readonly isIntentional: () => boolean;
    readonly onLost: () => void;
    readonly onRestored: () => void;
  }
): () => void {
  const element = gl.domElement;
  const handleLost = (event: Event) => {
    event.preventDefault();
    if (callbacks.isIntentional()) {
      return;
    }
    callbacks.onLost();
  };
  const handleRestored = () => {
    callbacks.onRestored();
  };
  element.addEventListener("webglcontextlost", handleLost);
  element.addEventListener("webglcontextrestored", handleRestored);
  return () => {
    element.removeEventListener("webglcontextlost", handleLost);
    element.removeEventListener("webglcontextrestored", handleRestored);
  };
}

/**
 * Releases a Three.js WebGLRenderer and forces WebGL context loss synchronously
 * so the browser's GPU context slot is freed before another canvas acquires it.
 * Neutralizes `forceContextLoss` afterward so React Three Fiber's unmount
 * teardown does not invoke `WEBGL_lose_context.loseContext()` a second time.
 */
export function disposeWebGLRenderer(gl: {
  readonly dispose: () => void;
  forceContextLoss: () => void;
  readonly getContext: () => { readonly isContextLost: () => boolean };
}): void {
  const context = gl.getContext();
  gl.dispose();
  if (!context.isContextLost()) {
    gl.forceContextLoss();
  }
  gl.forceContextLoss = () => undefined;
}
