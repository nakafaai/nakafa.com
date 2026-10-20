import {
  type ComponentType,
  lazy,
  type ReactNode,
  Suspense,
  useSyncExternalStore,
} from "react";

/** The options of a deferred component, named after the framework's dynamic import. */
interface DeferredOptions {
  /** Renders in place of the component until its module has loaded. */
  readonly loading?: () => ReactNode;
  /** `false` renders `loading` on the server and the component only after hydration. */
  readonly ssr?: boolean;
}

const subscribeToNothing = () => () => undefined;
const readOnClient = () => true;
const readOnServer = () => false;

/** Reports `false` on the server and during hydration, and `true` after it. */
function useHydrated() {
  return useSyncExternalStore(subscribeToNothing, readOnClient, readOnServer);
}

/**
 * Creates a component whose module loads when the component first renders, so
 * the module stays out of the first JavaScript of every route that does not
 * render it. The loader runs once, and React Suspense shows `loading` until the
 * module arrives.
 *
 * https://react.dev/reference/react/lazy
 */
export function lazyComponent<Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  options: DeferredOptions = {}
) {
  const Loaded = lazy(async () => ({ default: await load() }));
  const { loading, ssr = true } = options;

  return function DeferredComponent(props: Props) {
    const hydrated = useHydrated();
    const fallback = loading?.() ?? null;
    if (!(ssr || hydrated)) {
      return fallback;
    }

    return (
      <Suspense fallback={fallback}>
        <Loaded {...props} />
      </Suspense>
    );
  };
}
