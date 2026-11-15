# Spike 14: Open Badges 3.0 signing/verification and JobPosting JSON-LD

- **Issue:** #14 · **Owner:** pair ol · **Date:** 2026-11-14 · **Timebox:** hackathon day 1

## Question

Can we issue one signed Open Badges 3.0–shaped credential, verify it (and reject tampering), produce a JobPosting JSON-LD that validators accept, and decide how issuer private keys are stored — without putting secrets in git?

## Method

- Spike package: `spikes/14-open-badges` (Node 24.17.0, `jose@6`, `canonicalize@5`, `bs58@6`, `tsx`).
- Ed25519 issuer keypair as JWK (`pnpm keys`). Private key: `keys/private.jwk` (gitignored) or `CREDENTIALS_ISSUER_PRIVATE_JWK`. Public key: `keys/public.jwk`.
- Credential shape follows OB 3.0 examples: `@context` W3C VC v2 + OB 3.0.3, `type: ["VerifiableCredential","OpenBadgeCredential"]`, issuer Profile, AchievementSubject + Achievement + criteria.
- Proof: embedded `DataIntegrityProof` with cryptosuite **`eddsa-jcs-2022`** (JCS / RFC 8785 + SHA-256 + Ed25519, multibase `z` proofValue). Chosen over `eddsa-rdfc-2022` to avoid an RDF canonicalization stack in a 1–2h spike. `jose` used for keygen/JWK; Node `crypto` for sign/verify.
- JobPosting: `fixtures/job-posting.json` (schema.org JobPosting JSON-LD with title, description, datePosted, hiringOrganization, jobLocation, employmentType, validThrough).
- Smoke: `pnpm smoke` issues, verifies, tampers achievement name and expects failure.

```bash
cd spikes/14-open-badges
pnpm install
pnpm keys    # once
pnpm smoke   # sign + verify + tamper
pnpm verify  # re-check out/sample-credential.json
```

## Results

| Check | Measurement | Notes |
|---|---|---|
| Issue + verify | `pnpm smoke` → pass | Fresh credential verifies with public JWK |
| Tamper detection | `pnpm smoke` → pass | Renaming achievement → `signature mismatch` |
| Proof format | `DataIntegrityProof` / `eddsa-jcs-2022` | OB conformance suites prefer `eddsa-rdfc-2022`; JWT path is RS256 |
| JobPosting fields | Fixture includes Google JobPosting essentials | Validate manually: [Schema Markup Validator](https://validator.schema.org/) or [Rich Results Test](https://search.google.com/test/rich-results) |
| Private keys in repo | No | `.gitignore` + ADR 0006 |

## Pass criteria met?

- [x] Issue one signed credential and verify it
- [x] JobPosting JSON-LD ready for a structured-data validator (fixture + field check; paste into validator URL above)
- [x] Key storage approach decided (no private keys in the repo) — ADR 0006

## Decision

**Keep Ed25519 issuer keys outside git (env or mounted JWK file). Ship OB 3.0 JSON shape now; use `eddsa-jcs-2022` for the spike and early `#39`, with a follow-up to switch to `eddsa-rdfc-2022` if an OB validator or wallet requires RDFC.**

- Public verification material may be committed or served by the API (`GET` verification method / DID document in `#39`).
- JobPosting fixture is the Level 3 data contract for `#37` `<abol-job-card>`.

## Follow-ups

- `#39`: `POST/GET /api/credentials` using this sign/verify module (move out of `spikes/`).
- `#40`: `/verify/:id` page (valid / invalid / revoked).
- `#17`: mount credential routes on the Hono API.
- `#37`: consume `JobPosting` JSON-LD in `<abol-job-card>`.
- Optional: replace JCS cryptosuite with `eddsa-rdfc-2022` once we accept an RDF dependency; re-check against an Open Badges validator.
