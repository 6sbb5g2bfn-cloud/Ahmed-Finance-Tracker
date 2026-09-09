// Face ID / Touch ID app lock, via the browser's WebAuthn platform authenticator.
//
// This is a LOCAL DEVICE LOCK, not a replacement for the real account login.
// Supabase auth is still what actually protects your data. This just adds a
// "prove it's really you, physically, right now" gate in front of the UI,
// the same way a native app's biometric lock screen works.
//
// Because of that, verification is done entirely client-side: we don't send
// a challenge to a server and check a signature. If the OS reports that
// navigator.credentials.get() succeeded against the exact credential we
// registered, that's sufficient - only this device's Secure Enclave, unlocked
// by actual Face ID/Touch ID, can produce that success.

function randomChallenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}

function bufToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuf(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

export function faceIdSupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

// Call this directly from a button's onClick - must be a real user gesture.
export async function registerFaceId(userId, userLabel) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Finance Tracker" },
      user: {
        id: new TextEncoder().encode(userId),
        name: userLabel || "account",
        displayName: userLabel || "account",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none",
    },
  });
  if (!credential) throw new Error("Registration was cancelled");
  return bufToBase64url(credential.rawId);
}

// Call this directly from a button's onClick - must be a real user gesture.
export async function verifyFaceId(credentialIdB64url) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ id: base64urlToBuf(credentialIdB64url), type: "public-key" }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}
