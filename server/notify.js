import { Resend } from 'resend';
import twilio from 'twilio';

function required(value, label) {
  if (!value) throw new Error(`${label} is not configured`);
  return value;
}

export async function sendEmail({ to, message }) {
  const apiKey = required(process.env.RESEND_API_KEY, 'RESEND_API_KEY');
  const from = required(process.env.RESEND_FROM, 'RESEND_FROM');

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: 'Hotel Front Desk Alert',
    text: message,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Resend failed');
  }

  return { id: result.data?.id || null };
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
