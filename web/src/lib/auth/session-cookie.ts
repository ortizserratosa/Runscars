// Supabase SSR uses its default sb-<project>-auth-token storage key and may
// split a session into numbered cookies. Presence only selects the auth path;
// getClaims/getUser still verify every supplied session.
export function hasSessionCookie(cookies: ReadonlyArray<{ name: string }>) {
  return cookies.some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}
