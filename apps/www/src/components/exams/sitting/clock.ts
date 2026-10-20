/**
 * The correction that turns this device's clock into the server's, read from one round trip. The server
 * stamped its answer with its own time, which fell between the moment the request left this device and
 * the moment its answer arrived, so the middle of that round trip is the best guess of the server's time
 * at the send. A device whose clock is wrong gets the right time left once it applies this correction.
 */
export function serverClockOffset(round: {
  readonly receivedAt: number;
  readonly sentAt: number;
  readonly serverNow: number;
}): number {
  return round.serverNow - (round.sentAt + round.receivedAt) / 2;
}

/** The server's time now, from the device's time and the correction read from the last round trip. */
export function serverTime(deviceNow: number, offset: number): number {
  return deviceNow + offset;
}
