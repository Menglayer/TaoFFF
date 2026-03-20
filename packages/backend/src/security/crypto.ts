import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16

/** Derive a 32-byte key from any-length master key string using SHA-256 */
function deriveKey(masterKey: string): Buffer {
	return createHash("sha256").update(masterKey).digest()
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string containing: iv (16B) + authTag (16B) + ciphertext
 */
export function encrypt(plaintext: string, masterKey: string): string {
	const key = deriveKey(masterKey)
	const iv = randomBytes(IV_LENGTH)
	const cipher = createCipheriv(ALGORITHM, key, iv)
	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
	const tag = cipher.getAuthTag()
	return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

/**
 * Decrypt a base64-encoded AES-256-GCM payload.
 * Expects format: base64(iv + authTag + ciphertext)
 */
export function decrypt(encoded: string, masterKey: string): string {
	const key = deriveKey(masterKey)
	const buf = Buffer.from(encoded, "base64")
	const iv = buf.subarray(0, IV_LENGTH)
	const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
	const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
	const decipher = createDecipheriv(ALGORITHM, key, iv)
	decipher.setAuthTag(tag)
	return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8")
}
