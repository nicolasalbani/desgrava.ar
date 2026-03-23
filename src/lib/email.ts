import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "desgrava.ar <noreply@desgrava.ar>";

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${getBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verificá tu email — desgrava.ar",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Verificá tu email</h2>
        <p style="color: #555; line-height: 1.6;">
          Hacé clic en el siguiente enlace para verificar tu cuenta en desgrava.ar.
          Este enlace expira en 24 horas.
        </p>
        <a href="${url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px;">
          Verificar email
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Si no creaste una cuenta en desgrava.ar, puedes ignorar este email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Restablecer contraseña — desgrava.ar",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Restablecer contraseña</h2>
        <p style="color: #555; line-height: 1.6;">
          Recibimos una solicitud para restablecer tu contraseña en desgrava.ar.
          Este enlace expira en 1 hora.
        </p>
        <a href="${url}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px;">
          Restablecer contraseña
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Si no solicitaste restablecer tu contraseña, puedes ignorar este email.
        </p>
      </div>
    `,
  });
}
