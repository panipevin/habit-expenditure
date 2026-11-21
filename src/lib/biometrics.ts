const CREDENTIAL_KEY = 'cadence_biometric_cred_v1';
const PIN_HASH_KEY = 'cadence_privacy_pin_hash_v1';

export interface BiometricCapability {
  webAuthnAvailable: boolean;
  platformAuthenticator: boolean;
  enrolled: boolean;
  hasPinFallback: boolean;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(`cadence-vault:${input}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkBiometricCapability(): Promise<BiometricCapability> {
  const webAuthnAvailable =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials);

  let platformAuthenticator = false;
  if (webAuthnAvailable && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      platformAuthenticator = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      platformAuthenticator = false;
    }
  }

  return {
    webAuthnAvailable,
    platformAuthenticator,
    enrolled: Boolean(localStorage.getItem(CREDENTIAL_KEY)),
    hasPinFallback: Boolean(localStorage.getItem(PIN_HASH_KEY)),
  };
}

export async function enrollBiometricPasskey(userName: string): Promise<{ ok: boolean; method: 'webauthn' | 'unsupported'; message: string }> {
  const cap = await checkBiometricCapability();
  if (!cap.webAuthnAvailable || !cap.platformAuthenticator) {
    return {
      ok: false,
      method: 'unsupported',
      message: 'Hardware Face ID / Touch ID sensor is unavailable in this browser environment. Set a Privacy PIN below to lock your vault.',
    };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Cadence Workspace',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: userName || 'workspace-user',
          displayName: userName || 'Cadence User',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, method: 'webauthn', message: 'Biometric enrollment was cancelled.' };
    }

    localStorage.setItem(CREDENTIAL_KEY, bufferToBase64(credential.rawId));
    return {
      ok: true,
      method: 'webauthn',
      message: 'Device biometric passkey registered successfully.',
    };
  } catch (err) {
    return {
      ok: false,
      method: 'webauthn',
      message: err instanceof Error ? err.message : 'Biometric enrollment could not be completed.',
    };
  }
}

export async function verifyBiometricPasskey(): Promise<{ ok: boolean; message: string }> {
  const storedId = localStorage.getItem(CREDENTIAL_KEY);
  if (!storedId) {
    return { ok: false, message: 'No biometric passkey enrolled on this device.' };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            type: 'public-key',
            id: base64ToBuffer(storedId),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    if (!assertion) {
      return { ok: false, message: 'Biometric verification cancelled.' };
    }
    return { ok: true, message: 'Biometric identity verified.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Biometric verification failed.',
    };
  }
}

export async function setPrivacyPin(pin: string): Promise<void> {
  const hash = await sha256Hex(pin.trim());
  localStorage.setItem(PIN_HASH_KEY, hash);
}

export async function verifyPrivacyPin(pin: string): Promise<boolean> {
  const saved = localStorage.getItem(PIN_HASH_KEY);
  if (!saved) return false;
  const candidate = await sha256Hex(pin.trim());
  return candidate === saved;
}

export function clearBiometricEnrollment(): void {
  localStorage.removeItem(CREDENTIAL_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
}
