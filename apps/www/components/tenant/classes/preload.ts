import type { Ref } from "@confect/core";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { createContext } from "react";

/** The classes the layout's loader read on the server, which the sidebar shows until the live read answers. */
export type ClassesPreload =
  | Ref.Returns<typeof classroom.classes.mine>
  | undefined;

/** The loader's classes of the school sidebar, provided by the school shell. */
export const ClassesPreloadContext = createContext<ClassesPreload>(undefined);
