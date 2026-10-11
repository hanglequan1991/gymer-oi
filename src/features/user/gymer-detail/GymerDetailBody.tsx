// Thân hồ sơ khi đã có dữ liệu Gymer: giữ trạng thái chọn ngày, giờ và điều hướng sang đặt lịch.
import { useEffect, useState } from 'react';
import { useNavigate } from 'zmp-ui';
import { useAsync, useServices } from '@/hooks';
import { useBookingDraft } from '@/stores';
import type { Certificate, Gymer, Review, Slot } from '@/types/domain';
import { formatDateVN, weekdayVN } from '@/utils/format';
import { booking } from '@/routes/paths';
import { AboutSection } from './sections/AboutSection';
import { BookingBar } from './sections/BookingBar';
import { GymerHeader } from './sections/GymerHeader';
import { PriceSection } from './sections/PriceSection';
import { ReviewSection } from './sections/ReviewSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { SpecialtySection } from './sections/SpecialtySection';
import { toDateIso } from './utils';

export interface GymerDetailBodyProps {
  gymer: Gymer;
  certificates: Certificate[];
  reviews: Review[];
}

/** Ngày hiện tại theo lịch máy (giờ Việt Nam khi máy ở múi giờ đó). */
function todayView(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function GymerDetailBody({ gymer, certificates, reviews }: GymerDetailBodyProps) {
  const { schedule } = useServices();
  const navigate = useNavigate();
  const [view, setView] = useState(todayView);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Bản nháp của Gymer khác thì bỏ đi, tránh đặt nhầm ngày giờ cũ.
  useEffect(() => {
    const draft = useBookingDraft.getState();
    if (draft.gymerId !== undefined && draft.gymerId !== gymer.id) draft.clear();
  }, [gymer.id]);

  const monthState = useAsync(
    () => schedule.getMonth(gymer.id, view.year, view.month),
    [gymer.id, view.year, view.month],
  );

  const selectedDateIso = selectedDate ? toDateIso(selectedDate) : null;
  const selectedDay =
    selectedDate && monthState.data
      ? monthState.data.find((d) => toDateIso(d.date) === toDateIso(selectedDate))
      : undefined;

  function onMonthChange(year: number, month: number) {
    setView({ year, month });
    setSelectedDate(null);
    setSelectedSlot(null);
  }

  function onSelectDate(date: Date) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function onBook() {
    if (!selectedDate || !selectedSlot) return;
    useBookingDraft.getState().setDraft({
      gymerId: gymer.id,
      dateIso: toDateIso(selectedDate),
      slotId: selectedSlot.id,
    });
    navigate(booking(gymer.id));
  }

  const summary =
    selectedDate && selectedSlot
      ? `${weekdayVN(selectedDate)}, ${formatDateVN(selectedDate)} · ${selectedSlot.time}`
      : null;

  return (
    <>
      <GymerHeader gymer={gymer} />
      <AboutSection bio={gymer.bio} />
      <SpecialtySection tags={gymer.tags} certificates={certificates} />
      <PriceSection priceWeekday={gymer.priceWeekday} priceWeekend={gymer.priceWeekend} />
      <ScheduleSection
        gymerId={gymer.id}
        monthState={monthState}
        year={view.year}
        month={view.month}
        selectedDate={selectedDate}
        selectedDateIso={selectedDateIso}
        selectedSlotId={selectedSlot?.id ?? null}
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
        onSelectSlot={setSelectedSlot}
      />
      <ReviewSection reviews={reviews} />
      <BookingBar summary={summary} price={selectedDay?.price} onBook={onBook} />
    </>
  );
}
