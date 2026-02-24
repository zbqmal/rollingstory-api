/**
 * Parses the Set-Cookie header array from a supertest response
 * and returns an object mapping cookie names to their full raw string.
 */
export function parseCookieHeaders(
  setCookieHeader: string | string[] | undefined,
): Record<string, string> {
  if (!setCookieHeader) return {};
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const result: Record<string, string> = {};
  for (const cookie of cookieArray) {
    const name = cookie.split('=')[0];
    result[name] = cookie;
  }
  return result;
}

/**
 * Extracts the raw value of a named cookie (e.g., "access_token")
 * from the Set-Cookie header array. Returns empty string if not found.
 */
export function extractCookieValue(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string {
  if (!setCookieHeader) return '';
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return '';
  return cookie.split(';')[0].substring(name.length + 1);
}

/**
 * Extracts the full cookie string (name=value; flags...) for use with .set('Cookie', ...)
 * Only returns "name=value" portion (strips flags).
 */
export function extractCookieForRequest(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string {
  if (!setCookieHeader) return '';
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return '';
  return cookie.split(';')[0];
}

/**
 * Checks if a cookie has the HttpOnly flag
 */
export function isHttpOnly(
  setCookieHeader: string | string[] | undefined,
  name: string,
): boolean {
  if (!setCookieHeader) return false;
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return false;
  return /;\s*httponly/i.test(cookie);
}

/**
 * Checks if a cookie has the Secure flag
 */
export function isSecure(
  setCookieHeader: string | string[] | undefined,
  name: string,
): boolean {
  if (!setCookieHeader) return false;
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return false;
  return /;\s*secure/i.test(cookie);
}

/**
 * Gets the SameSite attribute value of a cookie (lowercase)
 */
export function getSameSite(
  setCookieHeader: string | string[] | undefined,
  name: string,
): string | null {
  if (!setCookieHeader) return null;
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return null;
  const match = cookie.match(/;\s*samesite=([^;]+)/i);
  return match ? match[1].toLowerCase().trim() : null;
}

/**
 * Checks if a cookie was cleared (value is empty string followed by semicolon)
 * e.g., "access_token=; Path=/; ..."
 */
export function isCookieCleared(
  setCookieHeader: string | string[] | undefined,
  name: string,
): boolean {
  if (!setCookieHeader) return false;
  const cookieArray = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  const cookie = cookieArray.find((c) => c.startsWith(`${name}=`));
  if (!cookie) return false;
  return cookie.startsWith(`${name}=;`);
}
