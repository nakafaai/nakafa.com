import { getCookie } from "@tanstack/react-start/server";
import {
  decodePlayerMode,
  PLAYER_MODE_COOKIE,
  type PlayerModeParam,
  resolvePlayerMode,
} from "@/components/player/mode";

/**
 * Resolves the view of one request before the page is sent, so the first
 * render already has the right view and nothing flickers: the address first,
 * then the view the learner saved, then the list. It reads the request that
 * the server is rendering, so it runs in a loader or a server function.
 */
export function readPlayerMode(param: PlayerModeParam) {
  const cookie = getCookie(PLAYER_MODE_COOKIE);
  return resolvePlayerMode({ cookie: decodePlayerMode(cookie), param });
}
