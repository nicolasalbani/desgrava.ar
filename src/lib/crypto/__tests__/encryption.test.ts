import { describe, it, expect, beforeEach, vi } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto/encryption";

// Valid 64-char hex string (32 bytes)
const TEST_KEY = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("encrypt / decrypt", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  });

  describe("round-trip", () => {
    it("decrypt returns the original plaintext", () => {
      const plaintext = "my secret password";
      const { encrypted, iv, authTag } = encrypt(plaintext);
      const result = decrypt(encrypted, iv, authTag);
      expect(result).toBe(plaintext);
    });

    it("works with an empty string", () => {
      const plaintext = "";
      const { encrypted, iv, authTag } = encrypt(plaintext);
      expect(decrypt(encrypted, iv, authTag)).toBe(plaintext);
    });

    it("works with a short plaintext", () => {
      const plaintext = "a";
      const { encrypted, iv, authTag } = encrypt(plaintext);
      expect(decrypt(encrypted, iv, authTag)).toBe(plaintext);
    });

    it("works with a long plaintext", () => {
      const plaintext = "x".repeat(10_000);
      const { encrypted, iv, authTag } = encrypt(plaintext);
      expect(decrypt(encrypted, iv, authTag)).toBe(plaintext);
    });

    it("works with unicode characters", () => {
      const plaintext = "contraseña con emojis: 🔑🇦🇷 y acentos àéîõü";
      const { encrypted, iv, authTag } = encrypt(plaintext);
      expect(decrypt(encrypted, iv, authTag)).toBe(plaintext);
    });

    it("works with JSON payloads", () => {
      const plaintext = JSON.stringify({ cuit: "20-12345678-9", clave: "s3cret" });
      const { encrypted, iv, authTag } = encrypt(plaintext);
      expect(decrypt(encrypted, iv, authTag)).toBe(plaintext);
    });
  });

  describe("randomness", () => {
    it("different plaintexts produce different ciphertexts", () => {
      const a = encrypt("plaintext-one");
      const b = encrypt("plaintext-two");
      expect(a.encrypted).not.toBe(b.encrypted);
    });

    it("same plaintext encrypted twice produces different outputs (random IV)", () => {
      const a = encrypt("identical");
      const b = encrypt("identical");
      expect(a.iv).not.toBe(b.iv);
      expect(a.encrypted).not.toBe(b.encrypted);
    });
  });

  describe("output format", () => {
    it("returns hex-encoded encrypted, iv, and authTag strings", () => {
      const { encrypted, iv, authTag } = encrypt("test");
      const hexRegex = /^[0-9a-f]+$/;
      expect(encrypted).toMatch(hexRegex);
      expect(iv).toMatch(hexRegex);
      expect(authTag).toMatch(hexRegex);
    });

    it("iv is 32 hex chars (16 bytes)", () => {
      const { iv } = encrypt("test");
      expect(iv).toHaveLength(32);
    });

    it("authTag is 32 hex chars (16 bytes)", () => {
      const { authTag } = encrypt("test");
      expect(authTag).toHaveLength(32);
    });
  });

  describe("tamper detection", () => {
    it("fails when ciphertext is tampered", () => {
      const { encrypted, iv, authTag } = encrypt("secret");
      // Flip a character in the ciphertext
      const tampered = encrypted[0] === "a" ? "b" + encrypted.slice(1) : "a" + encrypted.slice(1);
      expect(() => decrypt(tampered, iv, authTag)).toThrow();
    });

    it("fails when authTag is tampered", () => {
      const { encrypted, iv, authTag } = encrypt("secret");
      const tampered = authTag[0] === "a" ? "b" + authTag.slice(1) : "a" + authTag.slice(1);
      expect(() => decrypt(encrypted, iv, tampered)).toThrow();
    });

    it("fails when iv is tampered", () => {
      const { encrypted, iv, authTag } = encrypt("secret");
      const tampered = iv[0] === "a" ? "b" + iv.slice(1) : "a" + iv.slice(1);
      expect(() => decrypt(encrypted, tampered, authTag)).toThrow();
    });

    it("fails when decrypting with a different key", () => {
      const { encrypted, iv, authTag } = encrypt("secret");
      const differentKey = "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3";
      vi.stubEnv("ENCRYPTION_KEY", differentKey);
      expect(() => decrypt(encrypted, iv, authTag)).toThrow();
    });
  });

  describe("missing / invalid ENCRYPTION_KEY", () => {
    it("throws when ENCRYPTION_KEY is not set", () => {
      vi.stubEnv("ENCRYPTION_KEY", "");
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-char hex string");
    });

    it("throws when ENCRYPTION_KEY is too short", () => {
      vi.stubEnv("ENCRYPTION_KEY", "abcd");
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-char hex string");
    });
  });
});
