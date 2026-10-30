/**
 * The address that a room's QR code opens: the sitting's page on the school host the proctor is
 * on, with the token after the `#`. A browser never sends what follows the `#` to a server, so the
 * token stays out of request logs, and the sitting's page reads it to enter at once.
 */
export function roomJoinAddress(
  origin: string,
  sittingId: string,
  token: string
) {
  const address = new URL(`/sittings/${sittingId}`, origin);
  address.hash = token;
  return address.href;
}
