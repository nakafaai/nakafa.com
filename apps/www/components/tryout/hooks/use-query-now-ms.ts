"use client";

import { useInterval } from "@mantine/hooks";
import { useEffect, useState } from "react";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Returns a client clock value for tryout expiry-sensitive queries.
 *
 * These queries need second-level accuracy around expiry boundaries, so they
 * intentionally trade some cache reuse for timely status transitions.
 */
export function useTryoutQueryNowMs() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const interval = useInterval(() => {
    setNowMs(Date.now());
  }, MILLISECONDS_PER_SECOND);

  useEffect(() => {
    interval.start();

    return interval.stop;
  }, [interval]);

  return nowMs;
}
