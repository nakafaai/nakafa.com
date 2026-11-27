export function formatSigned(value: number) {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}
