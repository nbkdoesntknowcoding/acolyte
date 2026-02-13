/**
 * Currency formatting utilities for the admin engine.
 *
 * All monetary values from the backend are in PAISA (1 rupee = 100 paisa).
 * These helpers convert paisa → display strings.
 */

/** Format paisa as full INR with ₹ symbol. e.g. 1423456 paisa → "₹14,235" */
export function formatINR(paisa: number): string {
  const rupees = paisa / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Format paisa as compact INR. e.g. 1423456000 paisa → "₹1.4 Cr" */
export function formatINRShort(paisa: number): string {
  const rupees = paisa / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(1)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(1)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)} K`;
  return formatINR(paisa);
}

/** Convert paisa to rupees (for calculations, not display). */
export function paisaToRupees(paisa: number): number {
  return paisa / 100;
}

/** Convert rupees to paisa (for sending to backend). */
export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}
