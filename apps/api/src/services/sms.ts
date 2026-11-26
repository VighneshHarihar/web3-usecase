/** SMS adapter: console (dev) or a generic HTTPS webhook (MSG91 / Twilio / Gupshup via a tiny relay). */
import { config } from '../config.js';

export const sentMessages: { to: string; text: string; at: Date }[] = [];

export async function sendSms(to: string, text: string) {
  if (config.SMS_PROVIDER === 'webhook') {
    if (!config.SMS_WEBHOOK_URL) throw new Error('SMS_WEBHOOK_URL is not set');
    const res = await fetch(config.SMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.SMS_WEBHOOK_TOKEN ? { authorization: `Bearer ${config.SMS_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ to, text }),
    });
    if (!res.ok) throw new Error(`SMS webhook failed: ${res.status}`);
    return;
  }
  sentMessages.push({ to, text, at: new Date() });
  if (sentMessages.length > 100) sentMessages.shift();
  if (config.NODE_ENV !== 'test') console.log(`[sms:console] to=••••${to.slice(-4)} ${text.replace(/\d{6}/, '******')}`);
}
