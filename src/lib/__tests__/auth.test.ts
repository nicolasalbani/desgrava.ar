import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockCompare } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCompare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
  },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mockCompare },
  compare: mockCompare,
}));

async function getAuthorize() {
  const { getAuthOptions } = await import("@/lib/auth");
  const opts = getAuthOptions();
  const credentials = opts.providers.find(
    (p: { id?: string }) => p.id === "credentials",
  ) as unknown as {
    options: { authorize: (credentials: Record<string, string>) => Promise<unknown> };
  };
  return credentials.options.authorize;
}

describe("credentials authorize", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockCompare.mockReset();
  });

  it("returns the user when email is verified and password matches", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      image: null,
      passwordHash: "hash",
      emailVerified: new Date(),
    });
    mockCompare.mockResolvedValue(true);

    const authorize = await getAuthorize();
    const result = await authorize({ email: "a@b.com", password: "pw" });

    expect(result).toEqual({ id: "u1", email: "a@b.com", name: "A", image: null });
  });

  it("returns null when the user does not exist (no email enumeration leak)", async () => {
    mockFindUnique.mockResolvedValue(null);

    const authorize = await getAuthorize();
    const result = await authorize({ email: "ghost@b.com", password: "pw" });

    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("returns null when the password is wrong, even if the account is unverified (prevents enumeration of unverified accounts)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      image: null,
      passwordHash: "hash",
      emailVerified: null,
    });
    mockCompare.mockResolvedValue(false);

    const authorize = await getAuthorize();
    const result = await authorize({ email: "a@b.com", password: "wrong" });

    expect(result).toBeNull();
  });

  it("throws email_not_verified only when password is correct but email is unverified", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      image: null,
      passwordHash: "hash",
      emailVerified: null,
    });
    mockCompare.mockResolvedValue(true);

    const authorize = await getAuthorize();

    await expect(() => authorize({ email: "a@b.com", password: "pw" })).rejects.toThrow(
      "email_not_verified",
    );
  });

  it("returns null for Google-only users with no password hash", async () => {
    mockFindUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      name: "A",
      image: null,
      passwordHash: null,
      emailVerified: new Date(),
    });

    const authorize = await getAuthorize();
    const result = await authorize({ email: "a@b.com", password: "pw" });

    expect(result).toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it("returns null when credentials are missing", async () => {
    const authorize = await getAuthorize();
    const result = await authorize({ email: "", password: "" });
    expect(result).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
