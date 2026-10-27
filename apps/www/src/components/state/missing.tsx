import type { ReactNode } from "react";
import { DeferredFigure } from "@/components/state/mascot";
import {
  Screen,
  ScreenActions,
  ScreenDescription,
  ScreenFigure,
  ScreenHeader,
  ScreenTitle,
} from "@/components/state/screen";

interface MissingProps {
  /**
   * The ways on, as the page links them: the main one back to where the page
   * can be found, then a quiet one. A page inside the app gives
   * `ActionNavigation`, and a page that stands without the app gives
   * `ActionLink`.
   */
  children: ReactNode;
  description: string;
  title: string;
}

/**
 * The state of a page that cannot be found: Nina searching, and the ways back
 * to where it can. It renders on the server, for the page of a missing route
 * and of an address that matches no route at all. What it puts into the
 * payload of the other pages of its segment is its words and links, and a
 * reference to her picture. The scene of something that broke is `Broken`'s.
 */
export function Missing({ children, description, title }: MissingProps) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenFigure>
          <DeferredFigure scene="missing" />
        </ScreenFigure>
        <ScreenTitle>
          <h1>{title}</h1>
        </ScreenTitle>
        <ScreenDescription>{description}</ScreenDescription>
      </ScreenHeader>
      <ScreenActions>{children}</ScreenActions>
    </Screen>
  );
}
