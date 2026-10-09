/**
 * Tiện ích ngày. Quy ước:
 * - Tháng dùng chỉ số 0-based (giống `new Date(y, m, d)`): tháng 10 là 9.
 * - Mọi phép so sánh theo ngày địa phương, bỏ qua giờ.
 * - Tuần bắt đầu từ thứ Hai.
 */

/** Chỉ số theo Date.getDay(): 0 = CN, 1 = Thứ 2, ..., 6 = Thứ 7. */
export const VN_WEEKDAYS: readonly string[] = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/**
 * Lưới tháng: mỗi phần tử là một tuần gồm 7 ô, bắt đầu thứ Hai.
 * Ô không thuộc tháng (đệm đầu/cuối) là null. Tuần cuối luôn đủ 7 ô.
 */
export function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // đổi về tuần bắt đầu thứ Hai
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Hai thời điểm có cùng ngày địa phương hay không. */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Ngày `d` nằm trước `today` (so theo ngày, bỏ qua giờ). Cùng ngày thì trả false. */
export function isPastDay(d: Date, today: Date): boolean {
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return dayStart < todayStart;
}
