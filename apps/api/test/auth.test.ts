import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { validateTelegramInitData } from '../src/auth/telegram-validator.js';

describe('Telegram Mini App initData Signature Validation', () => {
  const dummyBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

  it('successfully validates authentic Telegram initData signature', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const user = { id: 987654321, first_name: 'Rustam', username: 'rustam_dev' };
    const userStr = JSON.stringify(user);

    // Build dataCheckString in alphabetical order
    const params = [
      `auth_date=${authDate}`,
      `query_id=AAHdF6IQAAAAAN0XohDhrP_e`,
      `user=${userStr}`,
    ];
    params.sort();
    const dataCheckString = params.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(dummyBotToken)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const rawInitData = `query_id=AAHdF6IQAAAAAN0XohDhrP_e&user=${encodeURIComponent(
      userStr
    )}&auth_date=${authDate}&hash=${hash}`;

    const res = validateTelegramInitData(rawInitData, dummyBotToken);
    expect(res.isValid).toBe(true);
    expect(res.user?.id).toBe(987654321);
    expect(res.user?.first_name).toBe('Rustam');
  });

  it('rejects tampered or invalid hash', () => {
    const rawInitData = `user=%7B%22id%22%3A123%7D&auth_date=${Math.floor(
      Date.now() / 1000
    )}&hash=invalid_tampered_hash_value`;

    const res = validateTelegramInitData(rawInitData, dummyBotToken);
    expect(res.isValid).toBe(false);
  });

  it('rejects expired initData', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 100000; // older than 24 hours
    const userStr = JSON.stringify({ id: 123, first_name: 'Test' });

    const params = [`auth_date=${oldAuthDate}`, `user=${userStr}`];
    params.sort();
    const dataCheckString = params.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(dummyBotToken)
      .digest();

    const hash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const rawInitData = `user=${encodeURIComponent(userStr)}&auth_date=${oldAuthDate}&hash=${hash}`;

    const res = validateTelegramInitData(rawInitData, dummyBotToken, 86400);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('expired');
  });
});
