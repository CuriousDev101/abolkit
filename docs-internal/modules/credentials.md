# Module: credentials (verifiable certificate links)

- **Owner:** pair ol · **Issues:** #14, #39, #40 · **Requirement:** R8 (career gateway) · **Standard:** Open Badges 3.0 (Level 3)

## Purpose

A graduate shares a link that an employer can open to verify a certificate: issuer, recipient, achievement and date, and whether it is genuine and unaltered.

## Design

- **Issue:** `POST /api/credentials` with recipient, achievement (name, description, criteria) and issue date. The server builds an Open Badges 3.0 credential (JSON-LD, W3C Verifiable Credentials data model) and signs it with an **Ed25519 key** (library such as `jose`; verify exact proof format against the spec during spike #14). Returns an id and a share link.
- **Fetch:** `GET /api/credentials/:id` returns the credential JSON.
- **Verify page:** `GET /verify/:id`, a plain accessible page that checks the signature and shows **valid / invalid / revoked** in words and icon-plus-text, issuer, recipient name, achievement, date. No script required for the basic result; optional script for re-verification.
- **Keys:** loaded from environment or a secret mount; never committed; document key generation in the self-host guide; the public key/DID document is served by the API so third parties can verify.
- **Privacy:** store the minimum (recipient name or pseudonymous id, achievement, date); retention setting; no tracking on the verify page.
- **Links:** use unguessable ids; a link reveals only what the credential contains.

## Done when

Issue → link → verify page works; tampering with the stored JSON makes verification fail; page passes axe, keyboard, 200% zoom; spec conformance checked against an Open Badges validator if one is available.

## Test plan

Unit tests for sign/verify and tamper detection; Playwright test on the verify page; manual screen-reader pass.

## Risks

Spec details (proof type, context URLs) are easy to get subtly wrong; allow time to cross-check with the official examples. If time runs short, ship a minimal valid credential and document what is not covered.
