import { describe, it, expect } from "vitest";
import {
  checkPasswordRules,
  isPasswordValid,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
  PASSWORD_RULES,
} from "@/lib/validators/password";

describe("PASSWORD_RULES", () => {
  it("has 5 rules", () => {
    expect(PASSWORD_RULES).toHaveLength(5);
  });
});

describe("checkPasswordRules", () => {
  it("returns all false for empty string", () => {
    const result = checkPasswordRules("");
    expect(result.minLength).toBe(false);
    expect(result.uppercase).toBe(false);
    expect(result.lowercase).toBe(false);
    expect(result.digit).toBe(false);
    expect(result.special).toBe(false);
  });

  it("detects minimum length", () => {
    expect(checkPasswordRules("1234567").minLength).toBe(false);
    expect(checkPasswordRules("12345678").minLength).toBe(true);
  });

  it("detects uppercase letters", () => {
    expect(checkPasswordRules("abcdefgh").uppercase).toBe(false);
    expect(checkPasswordRules("Abcdefgh").uppercase).toBe(true);
  });

  it("detects lowercase letters", () => {
    expect(checkPasswordRules("ABCDEFGH").lowercase).toBe(false);
    expect(checkPasswordRules("ABCDEFGh").lowercase).toBe(true);
  });

  it("detects digits", () => {
    expect(checkPasswordRules("abcdefgh").digit).toBe(false);
    expect(checkPasswordRules("abcdefg1").digit).toBe(true);
  });

  it("detects special characters", () => {
    expect(checkPasswordRules("Abcdefg1").special).toBe(false);
    expect(checkPasswordRules("Abcdefg1!").special).toBe(true);
  });

  it("detects various special characters", () => {
    expect(checkPasswordRules("@").special).toBe(true);
    expect(checkPasswordRules("#").special).toBe(true);
    expect(checkPasswordRules("$").special).toBe(true);
    expect(checkPasswordRules(" ").special).toBe(true);
    expect(checkPasswordRules("á").special).toBe(true);
  });
});

describe("isPasswordValid", () => {
  it("returns false for weak passwords", () => {
    expect(isPasswordValid("")).toBe(false);
    expect(isPasswordValid("short")).toBe(false);
    expect(isPasswordValid("abcdefgh")).toBe(false);
    expect(isPasswordValid("ABCDEFGH")).toBe(false);
    expect(isPasswordValid("Abcdefgh")).toBe(false);
    expect(isPasswordValid("Abcdefg1")).toBe(false);
  });

  it("returns true for strong passwords", () => {
    expect(isPasswordValid("Abcdefg1!")).toBe(true);
    expect(isPasswordValid("P@ssw0rd!")).toBe(true);
    expect(isPasswordValid("MyStr0ng#Pass")).toBe(true);
  });

  it("returns true for exactly minimum valid password", () => {
    expect(isPasswordValid("Aa1!xxxx")).toBe(true);
  });
});

describe("passwordSchema", () => {
  it("accepts valid password", () => {
    expect(passwordSchema.safeParse("Abcdefg1!").success).toBe(true);
  });

  it("rejects too short", () => {
    const r = passwordSchema.safeParse("Aa1!");
    expect(r.success).toBe(false);
  });

  it("rejects missing uppercase", () => {
    const r = passwordSchema.safeParse("abcdefg1!");
    expect(r.success).toBe(false);
  });

  it("rejects missing lowercase", () => {
    const r = passwordSchema.safeParse("ABCDEFG1!");
    expect(r.success).toBe(false);
  });

  it("rejects missing digit", () => {
    const r = passwordSchema.safeParse("Abcdefgh!");
    expect(r.success).toBe(false);
  });

  it("rejects missing special char", () => {
    const r = passwordSchema.safeParse("Abcdefg1x");
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = { email: "test@example.com", password: "Abcdefg1!", inviteCode: "abc123" };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "notanemail" }).success).toBe(false);
  });

  it("rejects weak password", () => {
    expect(registerSchema.safeParse({ ...valid, password: "weak" }).success).toBe(false);
  });

  it("rejects empty invite code", () => {
    expect(registerSchema.safeParse({ ...valid, inviteCode: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid input", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc", password: "Abcdefg1!" }).success).toBe(
      true,
    );
  });

  it("rejects empty token", () => {
    expect(resetPasswordSchema.safeParse({ token: "", password: "Abcdefg1!" }).success).toBe(false);
  });

  it("rejects weak password", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc", password: "weak" }).success).toBe(false);
  });
});
