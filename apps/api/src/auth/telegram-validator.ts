import crypto from 'node:crypto';
import { TelegramInitDataPayload, TelegramInitDataUser } from '@smart-quiz/shared';

export interface ValidationResult {
  isValid: boolean;
  user?: TelegramInitDataUser;
  authDate?: number;
  error?: string;
}

/**
 * Validates Telegram Mini App initData according to the official Telegram Web Apps specification.
 *
 * Algorithm:
 * 1. Parse initData query string.
 * 2. Extract `hash` param.
 * 3. Sort remaining key=value pairs in alphabetical order, join with newline (\n).
 * 4. Secret key = HMAC_SHA256("WebAppData", botToken)
 * 5. Calculate HMAC_SHA256(secretKey, dataCheckString).
 * 6. Compare computed hex with received `hash` using timingSafeEqual.
 * 7. Validate auth_date freshness (e.g. 24 hours).
 */
export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAgeSeconds = 86400
): ValidationResult {
  if (!initDataRaw) {
    return { isValid: false, error: 'initData parameter is missing' };
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      return { isValid: false, error: 'hash parameter is missing in initData' };
    }

    // Collect and sort parameters alphabetically except 'hash'
    const sortedEntries: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        sortedEntries.push(`${key}=${value}`);
      }
    });
    sortedEntries.sort();
    const dataCheckString = sortedEntries.join('\n');

    // Generate secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Generate hash
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison
    const hashBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (hashBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(hashBuffer, computedBuffer)) {
      return { isValid: false, error: 'Invalid HMAC signature' };
    }

    // Check expiration
    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (authDate <= 0 || now - authDate > maxAgeSeconds) {
      return { isValid: false, error: 'initData has expired' };
    }

    // Parse user object
    const userJson = params.get('user');
    let user: TelegramInitDataUser | undefined = undefined;
    if (userJson) {
      user = JSON.parse(userJson);
    }

    return {
      isValid: true,
      user,
      authDate,
    };
  } catch (err: any) {
    return { isValid: false, error: `Validation exception: ${err.message}` };
  }
}
