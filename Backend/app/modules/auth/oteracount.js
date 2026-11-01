// "Login with Oteracount" — Ote's own OpenID Connect provider (C:\data\Otenization\Oteracount).
// Code flow + PKCE S256 + state + nonce, RP-initiated logout. Lifted from OteRM
// (app/auth/oteracount.js, 08f51fc) and Bloteb (app/auth/ooauth.js); the integration guide is
// C:\data\Otenization\Reference\docs\GUIDE_OOAuth_for_apps.md (read it — register the client
// there first). Keys keep the guide's camelCase names so they copy straight across:
//
//   auth.oteracount: { enabled, issuer, clientId, clientSecret, redirectUri,
//                      postLogoutRedirectUri, scopes, default_role }
//
// redirectUri is the EXACT string registered in Oteracount. It is also the base of the
// callback URL given to openid-client: behind a tunnel/proxy the request may arrive as
// plain http on the local port, so the URL is never rebuilt from the request's own host.
import * as oidc from "openid-client";

export const oteracountConfig = (config) => config?.auth?.oteracount ?? {};

export function isConfigured(config) {
    const c = oteracountConfig(config);
    return Boolean(c.enabled && c.issuer && c.clientId && c.clientSecret && c.redirectUri);
}

let discovered = null;
let discoveredFor = null;

// Discovery is lazy and cached; a failure is not cached, so the next attempt retries.
export function discover(config) {
    const c = oteracountConfig(config);
    const key = `${c.issuer}|${c.clientId}`;
    if (discovered && discoveredFor === key) return discovered;
    discoveredFor = key;
    discovered = oidc
        .discovery(new URL(c.issuer), c.clientId, undefined, oidc.ClientSecretBasic(c.clientSecret), {
            // An http issuer is only acceptable on a LAN / dev box (the guide allows it there).
            execute: c.issuer.startsWith("http:") ? [oidc.allowInsecureRequests] : [],
            timeout: 5,
        })
        .catch((err) => {
            discovered = null;
            throw err;
        });
    return discovered;
}

/** Start a sign-in: the Oteracount authorize URL + the flow to keep (sealed) in a short-lived cookie. */
export async function startLogin(config, serverConfig = null) {
    const c = oteracountConfig(config);
    const cfg = serverConfig ?? (await discover(config));
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const url = oidc.buildAuthorizationUrl(cfg, {
        redirect_uri: c.redirectUri,
        scope: c.scopes || "openid profile email",
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce,
        prompt: "select_account", // the guide's advice for a sign-in button
    });
    return { url, flow: { verifier, state, nonce } };
}

/** The callback URL openid-client validates: the registered redirect URI + the query we received. */
export function callbackUrl(config, rawUrl) {
    const i = rawUrl.indexOf("?");
    return new URL(oteracountConfig(config).redirectUri + (i >= 0 ? rawUrl.slice(i) : ""));
}

/** Finish a sign-in: exchange the code, validate the ID token, fetch UserInfo. */
export async function finishLogin(config, rawUrl, flow) {
    const cfg = await discover(config);
    const tokens = await oidc.authorizationCodeGrant(cfg, callbackUrl(config, rawUrl), {
        pkceCodeVerifier: flow.verifier,
        expectedState: flow.state,
        expectedNonce: flow.nonce,
        idTokenExpected: true,
    });
    const claims = tokens.claims();
    const userinfo = await oidc.fetchUserInfo(cfg, tokens.access_token, claims.sub);
    return { sub: claims.sub, claims, userinfo, idToken: tokens.id_token };
}

/** "Sign out of Oteracount too": the end-session URL, with id_token_hint so it doesn't ask again. */
export async function endSessionUrl(config, idToken) {
    const c = oteracountConfig(config);
    const cfg = await discover(config);
    const params = { post_logout_redirect_uri: c.postLogoutRedirectUri, client_id: c.clientId };
    if (idToken) params.id_token_hint = idToken;
    return oidc.buildEndSessionUrl(cfg, params).href;
}
