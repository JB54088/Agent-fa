const PASSWORD_MIN_LENGTH = 8;
// Cloudflare Workers rejects a single PBKDF2 request above 100,000 iterations.
// Two sequential derivations keep the PBKDF2 family and preserve the original
// order of work without asking the runtime for an unsupported single request.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_STAGES = 2;
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
  const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS, PBKDF2_STAGES);
  return `pbkdf2_sha256_2x$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number, stages: number) {
  const cryptoApi = webCrypto();
  let input = encoder.encode(password);
  for (let stage = 0; stage < stages; stage += 1) {
    const key = await cryptoApi.subtle.importKey("raw", input, "PBKDF2", false, ["deriveBits"]);
    input = new Uint8Array(await cryptoApi.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      256,
    ));
  }
  return input;
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
  const stages = algorithm === "pbkdf2_sha256_2x" ? PBKDF2_STAGES : algorithm === "pbkdf2_sha256" ? 1 : 0;
  if (!stages || !Number.isSafeInteger(iterations) || iterations < 100_000 || !saltText || !digestText) return false;
  try {
    return constantTimeEqual(await derivePassword(password, fromBase64Url(saltText), iterations, stages), fromBase64Url(digestText));
  } catch {
    return false;
  }
}

export { PASSWORD_MIN_LENGTH };
