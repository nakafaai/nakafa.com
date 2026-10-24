import { Schema } from "effect";

/**
 * The server's time and the device's time at the moment the home's clock was anchored. The home's time moves on from
 * the server's time by the time the device has counted since that moment, so a device clock that is wrong moves no
 * countdown and no bar.
 */
const HomeAnchorSchema = Schema.Struct({
  deviceNow: Schema.Finite,
  serverNow: Schema.Finite,
});

/** The anchor of the home's time, with the type of its schema. */
export type HomeAnchor = typeof HomeAnchorSchema.Type;

/** The anchor for the server's time that the loader returned, at the device's time when the home renders. */
export const anchorAt = (serverNow: number, deviceNow: number): HomeAnchor => ({
  deviceNow,
  serverNow,
});

/** The home's time at a device time, which is the server's time at the anchor plus the device's time since then. */
export const homeTime = (anchor: HomeAnchor, deviceNow: number) =>
  anchor.serverNow + (deviceNow - anchor.deviceNow);
