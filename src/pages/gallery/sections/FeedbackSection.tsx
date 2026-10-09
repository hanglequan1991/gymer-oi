import { EMPTY_PRESETS, EmptyState, Notice, SuccessState } from '@/components/ui/feedback';
import { GButton } from '@/components/ui/controls';
import { Section } from '@/components/ui/layout';

/** Hàm rỗng cho nút hành động chỉ cần để hiện trong demo. */
const noop = () => undefined;

/** Thông báo, trạng thái rỗng và trạng thái thành công. Toast thử nằm ở đầu trang. */
export function FeedbackSection() {
  return (
    <Section className="gy-gallery__section" title="Phản hồi">
      <div className="gy-gallery__stack">
        <h3 className="gy-gallery__sub">Notice</h3>
        <Notice tone="warn" title="Cần xác nhận">
          Khung giờ này sẽ được giữ trong 15 phút.
        </Notice>
        <Notice tone="info" title="Mẹo">
          Bạn có thể đổi giờ trước 24 giờ.
        </Notice>
        <Notice tone="danger" title="Không thể đặt lịch">
          Khung giờ vừa được người khác đặt.
        </Notice>
        <Notice tone="ok" title="Đã lưu">
          Thông tin hồ sơ đã được cập nhật.
        </Notice>

        <h3 className="gy-gallery__sub">EmptyState</h3>
        <div className="gy-gallery__card">
          <EmptyState {...EMPTY_PRESETS.noGymer} />
        </div>
        <div className="gy-gallery__card">
          <EmptyState {...EMPTY_PRESETS.noRequests} action={<GButton kind="secondary">Làm mới</GButton>} />
        </div>

        <h3 className="gy-gallery__sub">SuccessState</h3>
        <div className="gy-gallery__card">
          <SuccessState title="Đã gửi yêu cầu" description="Gymer sẽ xác nhận trong 24 giờ." />
        </div>
        <div className="gy-gallery__card">
          <SuccessState
            title="Đặt lịch thành công"
            description="Bạn sẽ nhận nhắc lịch trước buổi tập."
            actionLabel="Xem lịch"
            onAction={noop}
          />
        </div>
      </div>
    </Section>
  );
}
