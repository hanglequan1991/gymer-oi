/**
 * Ghép tên class, bỏ qua giá trị falsy.
 * Quy ước: cx('gy-chip', isSelected && 'gy-chip--selected') -> 'gy-chip gy-chip--selected'.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}
