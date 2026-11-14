# 0006: Credentials issuer key storage

- **Status:** Proposed
- **Date:** 2026-11-14
- **Deciders:** pair ol (confirm with pair ab)

## Context

Open Badges 3.0 credentials are signed with an Ed25519 key. Private keys must never land in git. Judges and self-hosters need a clear, low-ceremony default that still matches production practice (env or secret mount).

## Options considered

1. **Commit a demo private key** — easy demos; unacceptable leak risk and bad habit.
2. **Env / secret-mount private JWK (or path)** — generate locally; commit only public JWK + `.env.example`; API loads `CREDENTIALS_ISSUER_PRIVATE_JWK` or a file path at runtime.
3. **Cloud KMS / HSM only** — strongest; too heavy for the hackathon compose default.

## Decision

Use **option 2**. Private Ed25519 JWK comes from the environment or a mounted file. Public JWK (and later a DID / verification-method document) may be committed or served by the API. Document key generation in the self-host guide when `#46` lands.

## Consequences

- Spike `#14` and later `#39` share the same env names.
- Compose needs a generated key or a one-line keygen step before issuing credentials.
- Exit if we later require HSM: keep the same env interface and swap the loader behind it.

## Evidence

`spikes/14-open-badges/RESULT.md`
