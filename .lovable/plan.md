# Fix AADSTS165000 on SAML sign-in

## What the error means

`AADSTS165000` from Microsoft Entra ID means the SAML authentication request that arrived at Microsoft did not match the browser session that finished the flow. In plain terms: cookies / state set at the start of the SSO redirect were not present (or did not match) when the browser came back. It is **not** a code bug in the app's sign-in button — it is an SSO configuration / browser-session issue between three parties: the app, Lovable Cloud's SAML endpoint, and Entra ID.

## Most likely root causes (in order)

1. **ACS / Entity ID mismatch in the Entra app.**
   The Entra "Enterprise Application" must be configured against Lovable Cloud's SAML endpoints, exactly:
   - Reply URL (ACS): `https://ieqjxltfujzzgpfqsnrh.supabase.co/auth/v1/sso/saml/acs`
   - Identifier (Entity ID): `https://ieqjxltfujzzgpfqsnrh.supabase.co/auth/v1/sso/saml/metadata`
   If Entra is pointing at the app's own domain (`core.radiouppsala.se` or `*.lovable.app`) instead, Entra issues a token bound to a different audience/session and rejects it as 165000.

2. **IdP-initiated sign-in attempted.**
   The flow we built is **SP-initiated** (`supabase.auth.signInWithSSO({ domain })`). If the user instead clicks the app tile in the Microsoft "My Apps" portal, Entra mints a SAML response with no matching outbound `AuthnRequest` — that surfaces as 165000. Sign-in must start from `/auth` in the app.

3. **Stale Microsoft session / multiple accounts.**
   Reusing a half-finished login from a previous tab, signing in with a different work account in another tab, or third-party-cookie blocking can all cause the request-token mismatch.

4. **SAML SSO provider registered with the wrong metadata or no domain mapping.**
   When `configure_saml_sso` was called earlier it was registered without a metadata URL or email-domain list. Without a metadata URL Lovable Cloud cannot verify Entra's response correctly, and without a domain mapping `signInWithSSO({ domain })` cannot route to Entra at all — both can manifest as confusing IdP errors.

## Plan

1. **Confirm Entra app config.** Open the Enterprise Application in Entra → Single sign-on → SAML, and verify:
   - Reply URL matches the ACS URL above exactly (no trailing slash, no custom domain).
   - Identifier matches the Entity ID above exactly.
   - "Sign on URL" is blank or points at `https://core.radiouppsala.se/auth` (forces SP-initiated).
2. **Re-run `configure_saml_sso`** with the real Entra **App Federation Metadata URL** and the list of email domains that should use this IdP (e.g. `radiouppsala.se`). Without these two values the SSO record is incomplete.
3. **Force SP-initiated flow.** Document for operators that SSO must be started from the app's `/auth` page (typing email → Continue), not from Microsoft My Apps.
4. **Reproduce cleanly.** In a fresh browser profile (no cached Entra session), sign in via `/auth`. If 165000 still appears, capture the Microsoft `Correlation Id` and the Lovable Cloud auth logs at the same timestamp to see whether the SAML response ever reached the ACS endpoint.
5. **Optional UI nudge.** On the auth page, add a short hint under the SSO field: "Use your work email — you'll be redirected to your company's sign-in" so users don't try the Microsoft tile path.

## What I'd change in code

Only step 5 touches the app. Steps 1–4 are Entra and Lovable Cloud config — no code edits, and they're what actually resolves AADSTS165000.

## Files

- `src/routes/auth.tsx` — add a one-line helper text under the Enterprise SSO input (cosmetic only).

Everything else is done via the Lovable Cloud SAML configuration tool and the Entra admin portal.
