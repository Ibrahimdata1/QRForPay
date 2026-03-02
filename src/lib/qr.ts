import { supabase } from './supabase'
import { Config } from '../../constants/config'

// EMV QR Code for PromptPay (Thailand)
// Reference: BOT Thai QR Payment Standard

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function formatPhoneForPromptPay(phone: string): string {
  // Strip leading 0, prepend country code 66
  const stripped = phone.replace(/\D/g, '')
  if (stripped.startsWith('0')) {
    return '0066' + stripped.substring(1)
  }
  return '0066' + stripped
}

function formatTaxIdForPromptPay(taxId: string): string {
  return taxId.replace(/\D/g, '').padStart(13, '0')
}

function crc16(data: string): string {
  // CRC16-CCITT (XModem) polynomial 0x1021
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function generatePromptPayPayload(
  promptPayId: string,
  amount: number
): string {
  if (amount <= 0) throw new Error('Amount must be greater than 0')
  if (amount > 999999) throw new Error('Amount must not exceed 999,999')

  const isPhone = promptPayId.replace(/\D/g, '').length <= 10

  // Build merchant account info (ID 29)
  const aid = tlv('00', 'A000000677010111')
  let accountInfo: string
  if (isPhone) {
    accountInfo = aid + tlv('01', formatPhoneForPromptPay(promptPayId))
  } else {
    accountInfo = aid + tlv('02', formatTaxIdForPromptPay(promptPayId))
  }

  // Build main payload without CRC
  let payload = ''
  payload += tlv('00', '01')                        // Payload Format Indicator
  payload += tlv('01', '12')                        // Dynamic QR
  payload += tlv('29', accountInfo)                  // PromptPay merchant info
  payload += tlv('53', '764')                       // Currency (THB)
  payload += tlv('54', amount.toFixed(2))            // Transaction Amount
  payload += tlv('58', 'TH')                        // Country Code
  payload += tlv('62', tlv('05', generateQRReference())) // Additional data - reference

  // Append CRC placeholder and calculate
  payload += '6304'
  const checksum = crc16(payload)
  payload += checksum

  return payload
}

export function generateQRReference(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `${timestamp}${random}`.toUpperCase()
}

export async function pollPaymentStatus(
  orderId: string,
  timeoutSeconds: number = Config.qr.timeout,
  onStatusChange: (status: string) => void
): Promise<'success' | 'expired' | 'cancelled'> {
  return new Promise((resolve) => {
    let resolved = false

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        channel.unsubscribe()
        onStatusChange('expired')
        resolve('expired')
      }
    }, timeoutSeconds * 1000)

    const channel = supabase
      .channel(`payment:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const status = payload.new.status as string
          onStatusChange(status)

          if (status === 'completed' && !resolved) {
            resolved = true
            clearTimeout(timer)
            channel.unsubscribe()
            resolve('success')
          } else if (status === 'failed' && !resolved) {
            resolved = true
            clearTimeout(timer)
            channel.unsubscribe()
            resolve('cancelled')
          }
        }
      )
      .subscribe()
  })
}
