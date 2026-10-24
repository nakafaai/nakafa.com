import { createContext } from "react";
import type {
  readStaffHomeFn,
  readStudentHomeFn,
} from "@/lib/tenant/home.functions";

/**
 * The first screen of the school home, as the home's loader read it on the server.
 * Each tile shows its loader's value until its live read answers, and the value of
 * a read that the viewer's view does not make is none.
 */
export type HomePreload = Partial<
  Pick<Awaited<ReturnType<typeof readStaffHomeFn>>, "home">
> &
  Partial<Pick<Awaited<ReturnType<typeof readStudentHomeFn>>, "sittings">>;

/** The loader's first screen of the school home, which the home's reads read from. */
export const HomePreloadContext = createContext<HomePreload>({});
