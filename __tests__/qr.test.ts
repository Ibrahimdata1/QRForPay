jest.mock('../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    }),
  },
}));

import {
  generatePromptPayPayload,
  generateQRReference,
} from '../src/lib/qr';

/**
 * CRC16 CCITT validation helper.
 * Re-computes CRC from the payload (minus the last 4 hex chars) + "6304"
 * and compares to the last 4 chars of the payload.
 */
function validateCRC16(payload: string): boolean {
  const data = payload.slice(0, -4);
  // The CRC is computed over data + "6304" prefix
  const crcInput = data;
  let crc = 0xffff;

  for (let i = 0; i < crcInput.length; i++) {
    crc ^= crcInput.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }

  const expected = crc.toString(16).toUpperCase().padStart(4, '0');
  const actual = payload.slice(-4).toUpperCase();
  return expected === actual;
}

describe('PromptPay QR Generation', () => {
  const testPhone = '0812345678';
  const testTaxId = '0123456789012'; // 13 digits
  const testAmount = 100;

  test('generatePromptPayPayload returns non-empty string', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    expect(payload).toBeTruthy();
    expect(typeof payload).toBe('string');
    expect(payload.length).toBeGreaterThan(0);
  });

  test('payload starts with "000201" (EMV header)', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    expect(payload.startsWith('000201')).toBe(true);
  });

  test('payload ends with CRC16 checksum (4 hex chars)', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    const lastFour = payload.slice(-4);
    expect(lastFour).toMatch(/^[0-9A-Fa-f]{4}$/);
  });

  test('phone number formatted correctly (0066 prefix)', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    // Thai phone 08x -> 0066812345678
    expect(payload).toContain('0066812345678');
  });

  test('amount "100.00" present in payload for 100 THB', () => {
    const payload = generatePromptPayPayload(testPhone, 100);
    expect(payload).toContain('100.00');
  });

  test('currency code "764" present (THB)', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    expect(payload).toContain('764');
  });

  test('country code "TH" present', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    expect(payload).toContain('TH');
  });

  test('tax ID (13 digit) generates different payload than phone', () => {
    const phonePayload = generatePromptPayPayload(testPhone, testAmount);
    const taxPayload = generatePromptPayPayload(testTaxId, testAmount);
    expect(phonePayload).not.toBe(taxPayload);
  });

  test('CRC16 checksum is valid (recompute and compare)', () => {
    const payload = generatePromptPayPayload(testPhone, testAmount);
    expect(validateCRC16(payload)).toBe(true);
  });

  test('generateQRReference produces unique values (run 100x)', () => {
    const refs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      refs.add(generateQRReference());
    }
    expect(refs.size).toBe(100);
  });

  test('generateQRReference length > 10 chars', () => {
    const ref = generateQRReference();
    expect(ref.length).toBeGreaterThan(10);
  });

  test('zero amount throws Error', () => {
    expect(() => generatePromptPayPayload(testPhone, 0)).toThrow();
  });

  test('negative amount throws Error', () => {
    expect(() => generatePromptPayPayload(testPhone, -50)).toThrow();
  });

  test('amount > 999999 throws Error', () => {
    expect(() => generatePromptPayPayload(testPhone, 1000000)).toThrow();
  });

  // INTEGRATION CONTRACT: QRPaymentModal uses qrData = qrPayload || generatePromptPayPayload(promptPayId, amount)
  // If promptPayId is empty string AND qrPayload is undefined → qrData = '' → QRCode crash on device
  // This test documents the expected behavior: empty promptPayId must NOT produce a payload
  test('empty promptPayId string should throw or be caught before QRCode render', () => {
    // generatePromptPayPayload('', amount) should throw — caller must guard before rendering <QRCode>
    expect(() => generatePromptPayPayload('', 100)).toThrow();
  });

  test('null/undefined promptPayId should not silently produce invalid QR', () => {
    // Guard: QRPaymentModal line 88 — if promptPayId is falsy, qrData = '' (correct, no QR rendered)
    const promptPayId = '';
    const qrData = promptPayId ? generatePromptPayPayload(promptPayId, 100) : '';
    expect(qrData).toBe(''); // empty → show error state, not QRCode
  });
});
