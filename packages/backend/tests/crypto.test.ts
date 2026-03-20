import { describe, expect, it } from "vitest"
import { decrypt, encrypt } from "../src/security/crypto"

describe("crypto", () => {
	const masterKey = "super-secret-master-key-12345"
	const plaintext = "my-secret-api-key"

	it("encrypts and decrypts successfully", () => {
		const encrypted = encrypt(plaintext, masterKey)
		expect(encrypted).not.toBe(plaintext)
		expect(typeof encrypted).toBe("string")

		const decrypted = decrypt(encrypted, masterKey)
		expect(decrypted).toBe(plaintext)
	})

	it("produces different ciphertexts for same plaintext (random IV)", () => {
		const encrypted1 = encrypt(plaintext, masterKey)
		const encrypted2 = encrypt(plaintext, masterKey)
		expect(encrypted1).not.toBe(encrypted2)
	})

	it("fails to decrypt with wrong key", () => {
		const encrypted = encrypt(plaintext, masterKey)
		expect(() => decrypt(encrypted, "wrong-key")).toThrow()
	})

	it("fails to decrypt tampered ciphertext", () => {
		const encrypted = encrypt(plaintext, masterKey)
		// Tamper with the base64 string (change first character)
		const tampered = (encrypted.startsWith("A") ? "B" : "A") + encrypted.slice(1)
		expect(() => decrypt(tampered, masterKey)).toThrow()
	})
})
