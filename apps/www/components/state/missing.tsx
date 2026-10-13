import type { ComponentProps, ReactNode } from "react";
import { DeferredFigure } from "@/components/state/figure.client";
import { Screen } from "@/components/state/screen";

interface MissingProps {
  /**
   * The ways on, as the page links them: the main one back to where the page
   * can be found, then a quiet one. A page inside the app gives
   * `ActionNavigation`, and a page that stands without the app gives
   * `ActionLink`.
   */
  children: ReactNode;
  description: string;
  /**
   * Which kind of page is missing, as the figure names its scenes: any page, or
   * one of Nakafa School. The scene of something that broke is `Broken`'s.
   */
  scene: Exclude<ComponentProps<typeof DeferredFigure>["scene"], "broken">;
  title: string;
}

/**
 * The state of a page that cannot be found: Nina searching, and the ways back
 * to where it can. It renders on the server, for the page of a missing route,
 * of a part such as School, and of an address that matches no route at all.
 * What it puts into the payload of the other pages of its segment is its words
 * and links, and a reference to her picture.
 */
export function Missing({ children, description, scene, title }: MissingProps) {
  return (
    <Screen
      actions={children}
      description={description}
      figure={<DeferredFigure scene={scene} />}
      title={title}
    />
  );
}
