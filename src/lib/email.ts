import { Resend } from "resend";

const FROM_EMAIL = "desgrava.ar <noreply@desgrava.ar>";

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const url = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Confirmá tu cuenta de Desgrava",
    html: `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>Confirmá tu cuenta</title>
    <style>
      a.btn, a.btn:link, a.btn:visited, a.btn:hover, a.btn:active {
        color: #ffffff !important;
        text-decoration: none !important;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px;">
            <tr>
              <td style="padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111111;">
                <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; color: #111111;">
                  Confirmá tu cuenta
                </h1>
                <p style="margin: 0 0 28px; color: #4b5563; line-height: 1.6; font-size: 15px;">
                  Tocá el botón para activar tu cuenta. El enlace expira en 24 horas.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="background-color: #2563eb; border-radius: 10px;">
                      <a class="btn" href="${url}" style="display: inline-block; padding: 16px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
                        Confirmar mi cuenta
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px; color: #6b7280; line-height: 1.6; font-size: 13px;">
                  ¿No funciona el botón? Copiá y pegá este enlace en tu navegador:
                </p>
                <p style="margin: 0 0 28px; color: #2563eb; word-break: break-all; font-size: 13px; line-height: 1.5;">
                  ${url}
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px;" />
                <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                  Si no creaste esta cuenta, podés ignorar este email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  });
}

export async function sendTrialReminderEmail(email: string, daysRemaining: number): Promise<void> {
  const subscribeUrl = `${getBaseUrl()}/configuracion`;
  const isUrgent = daysRemaining <= 1;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: isUrgent
      ? "Tu prueba gratis vence mañana — desgrava.ar"
      : `Te quedan ${daysRemaining} días de prueba gratis — desgrava.ar`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">
          ${isUrgent ? "Tu prueba gratis vence mañana" : `Te quedan ${daysRemaining} días de prueba gratis`}
        </h2>
        <p style="color: #555; line-height: 1.6;">
          ${
            isUrgent
              ? "Mañana se vence tu período de prueba en desgrava.ar. Para seguir usando todas las funcionalidades, suscribite al Plan Personal."
              : `Tu período de prueba en desgrava.ar vence en ${daysRemaining} días. Para seguir usando todas las funcionalidades sin interrupción, suscribite al Plan Personal.`
          }
        </p>
        <a href="${subscribeUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px;">
          Suscribirse ahora
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Si no querés continuar, no necesitás hacer nada. Tu cuenta pasará a modo lectura cuando termine el período de prueba.
        </p>
      </div>
    `,
  });
}

export async function sendNewTicketEmail(
  ticketId: string,
  subject: string,
  description: string,
  userEmail: string,
  pageUrl: string | null,
  automationJobId: string | null = null,
): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  const automationSection = automationJobId
    ? `<p style="color: #555; line-height: 1.6;"><strong>Automatización fallida:</strong> ${automationJobId}</p>`
    : "";

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: supportEmail,
    subject: `Nuevo ticket de soporte: ${subject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Nuevo ticket de soporte</h2>
        <p style="color: #555; line-height: 1.6;"><strong>ID:</strong> ${ticketId}</p>
        <p style="color: #555; line-height: 1.6;"><strong>Usuario:</strong> ${userEmail}</p>
        ${pageUrl ? `<p style="color: #555; line-height: 1.6;"><strong>Página:</strong> ${pageUrl}</p>` : ""}
        ${automationSection}
        <p style="color: #555; line-height: 1.6;"><strong>Asunto:</strong> ${subject}</p>
        <div style="margin-top: 16px; padding: 16px; background: #f9f9f9; border-radius: 8px; color: #333; line-height: 1.6;">
          ${description.replace(/\n/g, "<br>")}
        </div>
      </div>
    `,
  });
}

export async function sendTicketResolvedEmail(
  email: string,
  subject: string,
  resolution: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Tu consulta fue resuelta — desgrava.ar`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Tu consulta fue resuelta</h2>
        <p style="color: #555; line-height: 1.6;">
          Tu consulta "<strong>${subject}</strong>" fue revisada y resuelta.
        </p>
        <div style="margin-top: 16px; padding: 16px; background: #f9f9f9; border-radius: 8px; color: #333; line-height: 1.6;">
          ${resolution.replace(/\n/g, "<br>")}
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          Si tenés más preguntas, podés contactarnos desde la plataforma.
        </p>
      </div>
    `,
  });
}

export async function sendBugFixPREmail(
  ticketSubject: string,
  ticketId: string,
  prUrl: string,
  fixSummary: string,
): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: supportEmail,
    subject: `Fix listo para review: ${ticketSubject}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Bug fix listo para review</h2>
        <p style="color: #555; line-height: 1.6;"><strong>Ticket:</strong> ${ticketId}</p>
        <p style="color: #555; line-height: 1.6;"><strong>Asunto:</strong> ${ticketSubject}</p>
        <div style="margin-top: 16px; padding: 16px; background: #f9f9f9; border-radius: 8px; color: #333; line-height: 1.6;">
          <strong>Resumen del fix:</strong><br>
          ${fixSummary.replace(/\n/g, "<br>")}
        </div>
        <a href="${prUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 8px;">
          Ver Pull Request
        </a>
      </div>
    `,
  });
}

export async function sendNewDeductibleInvoicesEmail(email: string): Promise<void> {
  const url = `${getBaseUrl()}/comprobantes`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Tenés nuevos comprobantes disponibles para desgravar",
    html: `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>Nuevos comprobantes disponibles</title>
    <style>
      a.btn, a.btn:link, a.btn:visited, a.btn:hover, a.btn:active {
        color: #ffffff !important;
        text-decoration: none !important;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px;">
            <tr>
              <td style="padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111111;">
                <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; color: #111111;">
                  Tenés nuevos comprobantes disponibles para desgravar
                </h1>
                <p style="margin: 0 0 28px; color: #4b5563; line-height: 1.6; font-size: 15px;">
                  Revisamos tus comprobantes y detectamos nuevos que pueden ser usados para reducir tu Impuesto a las Ganancias. Ingresá a tu cuenta para verlos y enviarlos a SiRADIG.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="background-color: #2563eb; border-radius: 10px;">
                      <a class="btn" href="${url}" style="display: inline-block; padding: 16px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
                        Ver mis comprobantes
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 0 0 8px; color: #6b7280; line-height: 1.6; font-size: 13px;">
                  ¿No funciona el botón? Copiá y pegá este enlace en tu navegador:
                </p>
                <p style="margin: 0 0 28px; color: #2563eb; word-break: break-all; font-size: 13px; line-height: 1.5;">
                  ${url}
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px;" />
                <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                  Estás recibiendo este email porque tenés una cuenta en desgrava.ar.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const url = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  await getResend().emails.send({
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
