import { createTransport, type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

const devConsoleTransport = {
  name: "dev-console",
  version: "1.0.0",
  send(
    mail: { data: Mail.Options; message: { getEnvelope: () => unknown; messageId: () => string } },
    callback: (err: Error | null, info?: { envelope: unknown; messageId: string }) => void,
  ) {
    const { from, to, subject, text } = mail.data;
    const toStr = Array.isArray(to) ? to.join(", ") : String(to ?? "");
    console.log("\u2550".repeat(60));
    console.log("  DEV EMAIL");
    console.log("\u2550".repeat(60));
    console.log(`  From:    ${from}`);
    console.log(`  To:      ${toStr}`);
    console.log(`  Subject: ${subject}`);
    console.log("\u2500".repeat(60));
    if (text) console.log(String(text));
    console.log("\u2550".repeat(60));
    callback(null, {
      envelope: mail.message.getEnvelope(),
      messageId: mail.message.messageId(),
    });
  },
};

let _transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (_transporter) return _transporter;

  if (process.env.NODE_ENV === "production" && process.env.AWS_REGION) {
    const aws = await import("@aws-sdk/client-ses");
    const ses = new aws.SES({ region: process.env.AWS_REGION ?? "us-east-1" });
    _transporter = createTransport({
      SES: { ses, aws },
    } as Parameters<typeof createTransport>[0]);
  } else {
    _transporter = createTransport(devConsoleTransport);
  }

  return _transporter;
}

const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@clawforge.org";

export async function sendEmail(options: Omit<Mail.Options, "from">) {
  const transporter = await getTransporter();
  return transporter.sendMail({ from: EMAIL_FROM, ...options });
}
