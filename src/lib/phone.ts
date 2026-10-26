// Nomor WhatsApp disimpan dalam format internasional tanpa spasi, misalnya +6281234567890.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  if (!/^\d{9,15}$/.test(digits)) return null;
  return `+${digits}`;
}
