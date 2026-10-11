import { useState } from 'react';
import { Page } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader, Section } from '@/components/ui/layout';
import { CalendarLegend, DEFAULT_GYMER_LEGEND, MonthCalendar } from '@/components/ui/schedule';
import { useAsync, useServices } from '@/hooks';
import { vi } from '@/i18n';
import type { DayInfo, Gymer } from '@/types/domain';
import { GymerTabsLayout } from '../../GymerTabsLayout';
import { DaySlotsPanel } from '../DaySlotsPanel';
import { DefaultPricesSection } from '../DefaultPricesSection';
import { toDateIso } from '../scheduleModel';

/** Lịch một tháng kèm đúng tháng đó, để biết dữ liệu cũ có còn khớp với tháng đang xem không. */
interface MonthData {
  year: number;
  month: number; // 1-12
  days: DayInfo[];
}

interface Cursor {
  year: number;
  month: number; // 1-12
}

function todayCursor(): Cursor {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Phần nội dung khi đã có hồ sơ Gymer: giá mặc định, lịch tháng, khung giờ của ngày đang chọn. */
function ScheduleContent({ gymer }: { gymer: Gymer }) {
  const services = useServices();
  const [cursor, setCursor] = useState<Cursor>(todayCursor);
  const [selected, setSelected] = useState<Date | null>(null);

  const monthState = useAsync<MonthData>(async () => {
    const days = await services.schedule.getMonth(gymer.id, cursor.year, cursor.month);
    return { year: cursor.year, month: cursor.month, days };
  }, [services, gymer.id, cursor.year, cursor.month]);

  // Khi làm mới sau một thao tác, useAsync giữ dữ liệu cũ trong lúc tải. Dùng lại dữ liệu đó để lịch
  // không nhấp nháy về "Đang tải". Khi đổi tháng, dữ liệu cũ không khớp nên hiện trạng thái tải.
  const matched = monthState.data;
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
        onSaved={monthState.refetch}
      />

      <Section title={vi.gymerSchedule.calendar.title} data-testid="schedule-calendar">
        {matched && matched.year === cursor.year && matched.month === cursor.month ? (
          showMonth(matched)
        ) : (
          <AsyncView state={monthState} context="schedule">
            {(data) => showMonth(data)}
          </AsyncView>
        )}
      </Section>

      {selected ? (
        <DaySlotsPanel
          key={toDateIso(selected)}
          gymerId={gymer.id}
          date={selected}
          onChanged={monthState.refetch}
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
