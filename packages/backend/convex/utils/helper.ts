export function generateApiKey(): string {
  return crypto.randomUUID();
}
