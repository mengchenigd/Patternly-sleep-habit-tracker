import test from "node:test";
import assert from "node:assert/strict";
import { requestOriginAllowed } from "./origin.js";

const origin = "https://example-codespace-4173.app.github.dev";
const options = { expectedOrigin: origin, codespaceOrigin: origin, port: 4173 };
const forwarded = {
  origin: "http://localhost:4173", host: "localhost:4173",
  referer: `${origin}/`, "sec-fetch-site": "same-origin",
  "x-forwarded-host": "example-codespace-4173.app.github.dev",
  "x-forwarded-proto": "https",
};

test("accepts Codespaces rewritten Origin only with matching forwarding and browser headers", () => {
  assert.equal(requestOriginAllowed(forwarded, options), true);
  for (const field of Object.keys(forwarded)) {
    assert.equal(requestOriginAllowed({ ...forwarded, [field]: undefined }, options), false, field);
  }
  for (const [field, value] of Object.entries({
    origin: "https://evil.example", host: "evil.example", referer: "https://evil.example/",
    "sec-fetch-site": "cross-site", "x-forwarded-host": "another-codespace.app.github.dev",
    "x-forwarded-proto": "http",
  })) {
    assert.equal(requestOriginAllowed({ ...forwarded, [field]: value }, options), false, field);
  }
  assert.equal(requestOriginAllowed(forwarded, { ...options, codespaceOrigin: null }), false);
  assert.equal(requestOriginAllowed(forwarded, { ...options, expectedOrigin: "https://custom.example" }), false);
});

test("retains direct origin matching and rejects cross-site requests", () => {
  assert.equal(requestOriginAllowed({origin}, options), true);
  assert.equal(requestOriginAllowed({origin, "sec-fetch-site":"cross-site"}, options), false);
  assert.equal(requestOriginAllowed({}, options), false);
  assert.equal(requestOriginAllowed({origin:"http://localhost:4173"}, {expectedOrigin:"http://localhost:4173",port:4173}), true);
});
