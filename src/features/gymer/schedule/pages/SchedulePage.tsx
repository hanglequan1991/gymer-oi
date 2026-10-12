import { useState } from 'react';
import { Page } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { GButton } from '@/components/ui/controls';
import { AppHeader, Section } from '@/components/ui/layout';
import { CalendarLegend, DEFAULT_GYMER_LEGEND, MonthCalendar } from '@/components/ui/schedule';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import type { DayInfo, Gymer } from '@/types/domain';
import { vnToday, vnTodayDate } from '@/utils/date';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { BulkApplyPanel } from '../BulkApplyPanel';
import { DayOverrideEditor } from '../DayOverrideEditor';
import { DaySlotsPanel } from '../DaySlotsPanel';
import { DefaultPricesSection } from '../DefaultPricesSection';
import { toDateIso } from '../scheduleModel';

/** Lịch một tháng kèm đúng tháng đó, để biết dữ liệu cũ có còn khớp với tháng đang xem không. */
interface MonthData {
  year: number;
  month: number; // 1-12
  days: DayInfo[];
  /** Các ngày (YYYY-MM-DD) Gymer đang đóng cả ngày. */
  closedDays: ReadonlySet<string>;
}

interface Cursor {
  year: number;
  month: number; // 1-12
}

/** Tháng đang hiện theo ngày hôm nay ở giờ Việt Nam. */
function todayCursor(): Cursor {
  const { year, month } = vnToday();
  return { year, month: month + 1 };
}

/** Phần nội dung khi đã có hồ sơ Gymer: giá mặc định, lịch tháng, khung giờ của ngày đang chọn. */
function ScheduleContent({ gymer }: { gymer: Gymer }) {
  const services = useServices();
  const [cursor, setCursor] = useState<Cursor>(todayCursor);
  const [selected, setSelected] = useState<Date | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  // Mốc giá mặc định đang lưu. Sau khi đổi giá mặc định phải lấy lại, nếu không ngày nào cũng bị coi là có giá riêng.
  const [defaults, setDefaults] = useState({ weekday: gymer.priceWeekday, weekend: gymer.priceWeekend });

  const monthState = useAsync<MonthData>(async () => {
    // Lỗi của một trong hai truy vấn làm cả khối lỗi: nếu rơi về "không có ngày đóng" thì công tắc sẽ sai.
    const [days, closedDays] = await Promise.all([
      services.schedule.getMonth(gymer.id, cursor.year, cursor.month),
      services.schedule.getClosedDays(cursor.year, cursor.month),
    ]);
    return { year: cursor.year, month: cursor.month, days, closedDays: new Set(closedDays) };
  }, [services, gymer.id, cursor.year, cursor.month]);

  // Khi làm mới sau một thao tác, useAsync giữ dữ liệu cũ trong lúc tải. Dùng lại dữ liệu đó để lịch
  // không nhấp nháy về "Đang tải". Khi đổi tháng, dữ liệu cũ không khớp nên hiện trạng thái tải.
  const matched = monthState.data;
  const shownMonth = matched && matched.year === cursor.year && matched.month === cursor.month ? matched : undefined;

  const refreshDefaults = () => {
    // Lỗi thì giữ mốc cũ; lần mở lại trang sẽ đúng.
    services.profile
      .getMine()
      .then((detail) => setDefaults({ weekday: detail.gymer.priceWeekday, weekend: detail.gymer.priceWeekend }))
      .catch(() => undefined);
  };

  const selectedIso = selected ? toDateIso(selected) : null;
  const selectedDay = shownMonth?.days.find((d) => toDateIso(d.date) === selectedIso);
  const selectedIsPast = selectedIso !== null && selectedIso < toDateIso(vnTodayDate());
  const dayClosed = selectedIso !== null && (shownMonth?.closedDays.has(selectedIso) ?? false);
  const showMonth = (data: MonthData) => (
    <>
      <MonthCalendar
        variant="gymer"
        year={data.year}
        month={data.month}
        days={data.days}
        selected={selected}
        onSelect={setSelected}
        onMonthChange={(year, month) => {
          setCursor({ year, month });
          setSelected(null);
        }}
      />
      <CalendarLegend items={DEFAULT_GYMER_LEGEND} />
    </>
  );

  return (
    <>
      <DefaultPricesSection
        weekday={gymer.priceWeekday}
        weekend={gymer.priceWeekend}
        onSaved={() => {
          monthState.refetch();
          refreshDefaults();
        }}
      />

      <Section title={vi.gymerSchedule.calendar.title} data-testid="schedule-calendar">
        {shownMonth ? (
          showMonth(shownMonth)
        ) : (
          <AsyncView state={monthState} context="schedule">
            {(data) => showMonth(data)}
          </AsyncView>
        )}
        <GButton kind="secondary" fullWidth onClick={() => setBulkOpen((open) => !open)}>
          {vi.gymerSchedule.bulk.open}
        </GButton>
      </Section>

      {bulkOpen && (
        <BulkApplyPanel
          year={cursor.year}
          month={cursor.month}
          onApplied={monthState.refetch}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {selected ? (
        <DaySlotsPanel
          key={selectedIso === null ? undefined : `${selectedIso}|${dayClosed}`}
          gymerId={gymer.id}
          date={selected}
          dayClosed={dayClosed}
          onChanged={monthState.refetch}
          actions={
            selectedIsPast ? undefined : (
              <DayOverrideEditor
                date={selected}
                day={selectedDay}
                dayClosed={dayClosed}
                hasBooking={selectedDay?.marker === 'booked'}
                defaults={defaults}
                onChanged={monthState.refetch}
              />
            )
          }
        />
      ) : (
        <Section>
          <p role="status">{vi.gymerSchedule.calendar.pickHint}</p>
        </Section>
      )}
    </>
  );
}

/** Tải hồ sơ Gymer rồi dựng phần nội dung. Lỗi và tải lại do AsyncView lo. */
function ScheduleBody() {
  const services = useServices();
  const profile = useAsync(() => services.profile.getMine(), [services]);
  return (
    <AsyncView state={profile} context="schedule">
      {(detail) => <ScheduleContent gymer={detail.gymer} />}
    </AsyncView>
  );
}

export function SchedulePage() {
  return (
    <GymerTabsLayout activeKey="schedule" title={vi.gymerSchedule.title}>
      <Page>
        <AppHeader title={vi.gymerSchedule.title} data-testid="page-header" />
        <ScheduleBody />
      </Page>
    </GymerTabsLayout>
  );
}
