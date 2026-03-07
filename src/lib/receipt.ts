import { OrderWithItems } from '../types'

export function formatThaiCurrency(amount: number): string {
  return '\u0E3F' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function calculateChange(paid: number, total: number): number {
  return Math.max(0, paid - total)
}

export function generateOrderNumber(shopId: string): string {
  const now = new Date()
  const date = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0')
  const seq = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `${date}-${seq}`
}

export function formatReceipt(order: OrderWithItems): string {
  const divider = '================================'
  const lines: string[] = []

  lines.push(divider)
  lines.push('          EasyShop POS')
  lines.push(divider)
  lines.push(`Order: ${order.order_number}`)
  lines.push(`Date:  ${new Date(order.created_at).toLocaleString('th-TH')}`)
  lines.push(divider)

  for (const item of order.items) {
    const name = (item.product_id ?? 'ไม่ทราบ').substring(0, 20).padEnd(20)
    const qty = `x${item.quantity}`
    const price = formatThaiCurrency(item.subtotal)
    lines.push(`${name} ${qty.padStart(4)} ${price.padStart(10)}`)
  }

  lines.push(divider)
  lines.push(`Subtotal:      ${formatThaiCurrency(order.subtotal ?? 0).padStart(16)}`)

  if (order.discount_amount > 0) {
    lines.push(`Discount:      -${formatThaiCurrency(order.discount_amount).padStart(14)}`)
  }

  lines.push(`VAT (7%):      ${formatThaiCurrency(order.tax_amount ?? 0).padStart(16)}`)
  lines.push(divider)
  lines.push(`TOTAL:         ${formatThaiCurrency(order.total_amount ?? 0).padStart(16)}`)
  lines.push(divider)
  lines.push(`Payment: ${(order.payment_method ?? 'N/A').toUpperCase()}`)
  lines.push('')
  lines.push('       Thank you!')
  lines.push(divider)

  return lines.join('\n')
}
