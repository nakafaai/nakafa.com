import "server-only";

import { cookies } from "next/headers";
import {
  PLAYER_MODE_COOKIE,
  type PlayerMode,
  type PlayerModeParam,
  readPlayerModeCookie,
  resolvePlayerMode,
} from "@/components/player/mode";

/**
 * Resolves the view for one request from the lock, the view parameter, and
 * the remembered cookie, so the first render already has the right mode.
 */
export async function readPlayerMode(input: {
  readonly lock: PlayerMode | null;
  readonly param: PlayerModeParam;
}) {
  const cookie = (await cookies()).get(PLAYER_MODE_COOKIE)?.value;
  return resolvePlayerMode({
    cookie: readPlayerModeCookie(cookie),
    lock: input.lock,
    param: input.param,
  });
}
