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

export const sendWhatsApp = async (saleId: string, partyName: string, date: string, total: number) => {
  try {
    const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/party_phone/${encodeURIComponent(partyName)}`);
    const data = await res.json();
    let phone = data.success && data.phone ? data.phone : null;

    if (!phone) {
      phone = window.prompt(`Enter WhatsApp number for ${partyName} (Include country code, e.g., 919876543210):`);
      if (!phone) return;
    }

    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const message = `*Vellore Spun Pipes - Invoice*\n\n` +
      `Hello ${partyName},\n` +
      `Your invoice/estimate for the order on *${date}* has been generated.\n\n` +
      `*Order ID:* ${saleId}\n` +
      `*Total Amount:* ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` +
      `You can find the detailed PDF attached to this message. Thank you for your business!`;

    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waLink, '_blank');

  } catch (err) {
    console.error(err);
    alert("Failed to send WhatsApp message");
  }
};
