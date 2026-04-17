import { describe, it, expect } from "vitest";
import { initialFromParams } from "../initial-from-params";

describe("initialFromParams", () => {
  it("returns empty strings when no params are present", () => {
    expect(initialFromParams({})).toEqual({ error: "", success: "" });
  });

  it("returns a success message when email was just verified", () => {
    expect(initialFromParams({ verified: "true" })).toEqual({
      error: "",
      success: "Email verificado. Ya puedes iniciar sesión.",
    });
  });

  it("returns a success message when password was just reset", () => {
    expect(initialFromParams({ reset: "true" })).toEqual({
      error: "",
      success: "Contraseña actualizada. Ya puedes iniciar sesión.",
    });
  });

  it("returns an error message for an invalid verification token", () => {
    expect(initialFromParams({ error: "invalid_token" })).toEqual({
      error: "El enlace de verificación es inválido.",
      success: "",
    });
  });

  it("returns an error message for an expired verification token", () => {
    expect(initialFromParams({ error: "token_expired" })).toEqual({
      error: "El enlace de verificación expiró.",
      success: "",
    });
  });

  it("ignores unknown error values", () => {
    expect(initialFromParams({ error: "something_else" })).toEqual({ error: "", success: "" });
  });

  it("ignores non-'true' values for verified/reset", () => {
    expect(initialFromParams({ verified: "1" })).toEqual({ error: "", success: "" });
    expect(initialFromParams({ reset: "yes" })).toEqual({ error: "", success: "" });
  });
});
