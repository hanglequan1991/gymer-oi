/**
 * Lấy chữ cái đầu của từ đầu và từ cuối: "Minh Hà" -> "MH", "Nam" -> "N", rỗng hoặc khoảng trắng -> "?".
 */
export function getInitials(name: string): string {
  const words = name.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('vi-VN');
}
