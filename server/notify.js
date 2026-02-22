import nodemailer from 'nodemailer';
import twilio from 'twilio';

function required(value, label) {
  if (!value) throw new Error(`${label} is not configured`);
  return value;
}

export async function sendEmail({ to, message }) {
  const host = required(process.env.SMTP_HOST, 'SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const user = required(process.env.SMTP_USER, 'SMTP_USER');
  const pass = required(process.env.SMTP_PASS, 'SMTP_PASS');
  const from = required(process.env.SMTP_FROM, 'SMTP_FROM');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Hotel Front Desk Alert',
    text: message,
  });

  return { messageId: info.messageId };
}

export async function sendSms({ to, message }) {
  const accountSid = required(process.env.TWILIO_ACCOUNT_SID, 'TWILIO_ACCOUNT_SID');
  const authToken = required(process.env.TWILIO_AUTH_TOKEN, 'TWILIO_AUTH_TOKEN');
  const from = required(process.env.TWILIO_FROM_NUMBER, 'TWILIO_FROM_NUMBER');

  const client = twilio(accountSid, authToken);
  const result = await client.messages.create({
    from,
    to,
    body: message,
  });

  return { sid: result.sid, status: result.status };
}
