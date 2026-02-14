/**
 * Format a number as Indian Rupees (INR) with Indian numbering system.
 *
 * Examples:
 *   formatINR(1423456)    → "14,23,456"
 *   formatINR(142356000)  → "14,23,56,000"
 *   formatINR(45000)      → "45,000"
 */
export function formatINR(amount: number): string {
  const formatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

/**
 * Format a number as INR with ₹ prefix.
 *
 * Examples:
 *   formatINRCurrency(1423456)  → "₹14,23,456"
 */
export function formatINRCurrency(amount: number): string {
  return `₹${formatINR(amount)}`;
}

/**
 * Format large INR amounts in Lakhs/Crores.
 *
 * Examples:
 *   formatINRCompact(14235600)   → "₹1.42 Cr"
 *   formatINRCompact(450000)     → "₹4.5 L"
 *   formatINRCompact(45000)      → "₹45,000"
 */
export function formatINRCompact(amount: number): string {
  if (amount >= 1_00_00_000) {
    const crores = amount / 1_00_00_000;
    return `₹${crores % 1 === 0 ? crores.toFixed(0) : crores.toFixed(1)} Cr`;
  }
  if (amount >= 1_00_000) {
    const lakhs = amount / 1_00_000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)} L`;
  }
  return formatINRCurrency(amount);
}
