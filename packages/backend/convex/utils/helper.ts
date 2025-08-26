export function generateAccessToken(): string {
  return crypto.randomUUID();
}
