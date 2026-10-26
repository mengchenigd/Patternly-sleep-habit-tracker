// Codespaces rewrites Origin/Host to loopback but preserves the external Referer and forwarding headers.
export function requestOriginAllowed(headers, { expectedOrigin, codespaceOrigin, port }) {
  if (headers["sec-fetch-site"] === "cross-site") return false;
  if (headers.origin === expectedOrigin) return true;
  if (!codespaceOrigin || expectedOrigin !== codespaceOrigin) return false;
  let refererOrigin;
  try {
    refererOrigin = new URL(headers.referer).origin;
  } catch {
    return false;
  }
  const external = new URL(codespaceOrigin);
  return headers.origin === `http://localhost:${port}` &&
    headers.host === `localhost:${port}` &&
    headers["x-forwarded-host"] === external.host &&
    headers["x-forwarded-proto"] === "https" &&
    headers["sec-fetch-site"] === "same-origin" &&
    refererOrigin === expectedOrigin;
}
