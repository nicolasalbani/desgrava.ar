import type { LoginFormInitial } from "./login-form";

export function initialFromParams(params: {
  error?: string;
  verified?: string;
  reset?: string;
}): LoginFormInitial {
  let error = "";
  if (params.error === "invalid_token") error = "El enlace de verificación es inválido.";
  else if (params.error === "token_expired") error = "El enlace de verificación expiró.";

  let success = "";
  if (params.verified === "true") success = "Email verificado. Ya puedes iniciar sesión.";
  else if (params.reset === "true") success = "Contraseña actualizada. Ya puedes iniciar sesión.";

  return { error, success };
}
