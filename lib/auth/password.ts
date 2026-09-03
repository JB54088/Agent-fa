const PASSWORD_MIN_LENGTH = 8;
const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is required for password hashing.");
  return globalThis.crypto;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertPassword(password: string) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error("password_too_short");
  }
}

export async function hashPassword(password: string) {
  assertPassword(password);
  const cryptoApi = webCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await cryptoApi.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await cryptoApi.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(derived))}`;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded || typeof password !== "string") return false;
  const [algorithm, iterationsText, saltText, digestText] = encoded.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !Number.isSafeInteger(iterations) || iterations < 100_000 || !saltText || !digestText) return false;
  try {
    const cryptoApi = webCrypto();
    const key = await cryptoApi.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = await cryptoApi.subtle.deriveBits(
      { name: "PBKDF2", salt: fromBase64Url(saltText), iterations, hash: "SHA-256" },
      key,
      256,
    );
    return constantTimeEqual(new Uint8Array(derived), fromBase64Url(digestText));
  } catch {
    return false;
  }
}

export { PASSWORD_MIN_LENGTH };
