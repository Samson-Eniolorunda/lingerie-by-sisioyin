/** The current time for server pages; kept in one async helper so pages stay free of impure calls. */
export async function nowMs(): Promise<number> {
  return Date.now();
}
