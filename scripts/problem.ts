/** Reports `message` when a policy check finds its rule `broken`. */
export function problemWhen(broken: boolean, message: string) {
  return broken ? [message] : [];
}
