// Tìm Gymer (khách): xin vị trí, lọc theo bộ lọc, danh sách thẻ Gymer. Kết quả lấy qua services.gymers.search.
import { Page, useNavigate } from 'zmp-ui';
import { AsyncView } from '@/components/app';
import { AppHeader, EmptyState, EMPTY_PRESETS, GButton, GymerCard, Notice } from '@/components/ui';
import { useAsync, useCurrentLocation, useServices } from '@/hooks';
import { vi } from '@/i18n';
import { PATHS, gymerDetail } from '@/routes/paths';
import { useSearchFilters } from '@/stores';
import type { Gymer } from '@/types/domain';
import { RADIUS_OPTIONS } from '@/types/geo';
import { LocationGate } from '../components/LocationGate';
import { SearchFilters } from '../components/SearchFilters';
import { SEARCH_LIMIT, buildGymerSearch } from '../query';

const search = vi.search;

export function SearchPage() {
  const navigate = useNavigate();
  const { gymers } = useServices();
  const current = useCurrentLocation();
  const filters = useSearchFilters();
  const { point } = current;
  const lat = point?.lat;
  const lng = point?.lng;

  // Chưa có vị trí thì không gọi server; trả danh sách rỗng, phần hiển thị nằm dưới cổng vị trí.
  const state = useAsync<Gymer[]>(() => {
    if (!point) return Promise.resolve([]);
    return gymers.search(buildGymerSearch(filters, point));
    // Phụ thuộc là các giá trị nguyên thuỷ, để đổi bất kỳ bộ lọc nào thì tìm lại.
  }, [
    lat,
    lng,
    filters.radiusKm,
    filters.keyword,
    filters.specialty,
    filters.gender,
    filters.onlyTopRated,
    filters.age20to30,
    filters.under200k,
  ]);

  const nextRadius = RADIUS_OPTIONS.find((r) => r > filters.radiusKm);

  return (
    <Page>
      <AppHeader
        title={search.title}
        data-testid="page-header"
        below={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>{search.radiusText(filters.radiusKm)}</span>
            <span style={{ display: 'flex', gap: 12 }}>
              <button type="button" style={linkStyle} onClick={() => navigate(PATHS.myBookings)}>
                {search.myBookings}
              </button>
              <button type="button" style={linkStyle} onClick={() => navigate(PATHS.gymerRoot)}>
                {search.forGymers}
              </button>
            </span>
          </div>
        }
      />

      {point === undefined ? (
        <LocationGate status={current.status} error={current.error} onRequest={() => void current.request()} />
      ) : (
        <>
          <SearchFilters />
          <div style={{ padding: '8px 16px 16px', display: 'grid', gap: 12 }}>
            <AsyncView
              state={state}
              context="search"
              isEmpty={(list) => list.length === 0}
              empty={
                <EmptyState
                  {...EMPTY_PRESETS.noGymer}
                  action={
                    nextRadius !== undefined ? (
                      <GButton kind="secondary" onClick={() => filters.setRadius(nextRadius)}>
                        {search.increaseRadius}
                      </GButton>
                    ) : undefined
                  }
                />
              }
            >
              {(list) => (
                <>
                  <p role="status" style={{ margin: 0 }}>
                    {search.resultCount(list.length)}
                  </p>
                  {list.length >= SEARCH_LIMIT && <Notice tone="info">{search.resultCap}</Notice>}
                  {list.map((gymer) => (
                    <GymerCard
                      key={gymer.id}
                      gymer={gymer}
                      onClick={(id) => navigate(gymerDetail(id))}
                    />
                  ))}
                </>
              )}
            </AsyncView>
          </div>
        </>
      )}
    </Page>
  );
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'inherit',
  font: 'inherit',
  textDecoration: 'underline',
  cursor: 'pointer',
} as const;
