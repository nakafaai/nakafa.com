import "@tanstack/react-start/server-only";

import { cookies } from "next/headers";
import {
  decodePlayerMode,
  PLAYER_MODE_COOKIE,
  type PlayerModeParam,
  resolvePlayerMode,
} from "@/components/player/mode";

/**
 * Resolves the view of one request before the page is sent, so the first
 * render already has the right view and nothing flickers: the address first,
 * then the view the learner saved, then the list.
 */
export async function readPlayerMode(param: PlayerModeParam) {
  const cookie = (await cookies()).get(PLAYER_MODE_COOKIE)?.value;
  return resolvePlayerMode({ cookie: decodePlayerMode(cookie), param });
}
