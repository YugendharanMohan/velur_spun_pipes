import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sortProductsByDiameter<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Extract diameter number (e.g., from "450 MM DIA...", "1000 MM...")
    const matchA = a.name.match(/(\d+)\s*MM/i);
    const matchB = b.name.match(/(\d+)\s*MM/i);

    const diaA = matchA ? parseInt(matchA[1], 10) : 0;
    const diaB = matchB ? parseInt(matchB[1], 10) : 0;

    // Both have valid diameters, sort by numeric diameter ascending
    if (diaA && diaB && diaA !== diaB) {
      return diaA - diaB;
    }

    // Sort items without a diameter (dia=0) after items with a diameter
    if (diaA && !diaB) return -1;
    if (!diaA && diaB) return 1;

    // Fallback exactly to alphabetical order if same diameter or neither has diameter
    return a.name.localeCompare(b.name);
  });
}

export const sendWhatsApp = (saleId: string, partyName: string, date: string, total: number, phone?: string) => {
  let p = phone || window.prompt(`Enter WhatsApp number for ${partyName} (e.g. 919876543210):`);
  if (!p) return;
  p = p.replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  const message =
    `*Velur Spun Pipes*\n\nHello ${partyName},\nYour invoice for *${date}* is ready.\n\n` +
    `*Invoice No:* ${saleId.slice(0, 8).toUpperCase()}\n*Amount:* ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nThank you!`;
  window.open(`https://wa.me/${p}?text=${encodeURIComponent(message)}`, '_blank');
};
