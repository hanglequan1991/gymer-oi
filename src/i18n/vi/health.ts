// Chuỗi ghi chú sức khoẻ (Đợt 5, 9-10): ô đồng ý và giải thích (khách, S1), màn thành công (S3),
// khối ghi chú phía Gymer (S4). Nguồn: docs/design/health-consent-booking.md mục 3.1, 3.3, 3.4.
// Chữ có tham số là hàm trả string. Khoá do T-N2-1 đặt; các task sau chỉ đọc.
export const health = {
  // S1: ô Mục tiêu và ô Ghi chú sức khoẻ (3.1, 3.1.1, 3.1.4)
  goalHelper:
    'Gymer luôn thấy mục tiêu này. Đừng ghi bệnh hay chấn thương ở đây, hãy ghi ở ô Ghi chú sức khoẻ bên dưới.',
  goalCounterWarn: (remaining: number) => `Còn ${remaining} ký tự`,
  goalTooLong: 'Mục tiêu tối đa 200 ký tự.',
  noteLabel: 'Ghi chú sức khoẻ (không bắt buộc)',
  noteHelper:
    'Ví dụ: chấn thương, bệnh nền, thuốc đang dùng. Chỉ ghi điều Gymer cần biết để tập an toàn.',
  noteTooLong: 'Ghi chú tối đa 1000 ký tự.',

  // S1: ô đồng ý (3.1.2, 3.1.3, 3.1.4)
  consentLabel: (gymerName: string) => `Cho ${gymerName} xem ghi chú sức khoẻ của tôi`,
  consentDisabledReason: 'Nhập ghi chú sức khoẻ ở trên để bật lựa chọn này.',
  consentCollapsed: 'Chia sẻ ghi chú sức khoẻ với Gymer là tuỳ chọn. Nhập ghi chú để xem chi tiết.',
  consentExplainTitle: 'Nếu bạn chọn chia sẻ',
  consentExplain1: (gymerName: string) =>
    `Chỉ ${gymerName} xem được nội dung ghi chú. Người dùng khác không xem được.`,
  consentExplain2: (gymerName: string, untilText: string) =>
    `${gymerName} xem được từ lúc bạn gửi yêu cầu, chừng nào yêu cầu còn chờ duyệt hoặc đã được xác nhận, và đến ${untilText} (1 ngày sau khi buổi tập kết thúc).`,
  consentExplain3: (gymerName: string) =>
    `${gymerName} sẽ không xem được nữa ngay khi yêu cầu bị từ chối, hết hạn hoặc bị huỷ.`,
  consentExplain4:
    'Không thể rút lại sau khi bạn gửi yêu cầu. Nếu muốn dừng chia sẻ, bạn phải huỷ lịch này trước giờ bắt đầu.',
  consentExplain5: (gymerName: string) =>
    `Nếu ${gymerName} đã đọc hoặc chép lại nội dung trước đó, Gymer ơi không thu hồi được.`,
  consentExplainFooter: (gymerName: string) =>
    `Nếu không chọn, ${gymerName} sẽ không xem được ghi chú.`,
  consentStatusCleared: 'Đã bỏ chọn chia sẻ vì ghi chú đang trống.',
  consentStatusEnabled: 'Đã bật ô chia sẻ ghi chú.',
  consentStatusTimeChanged: 'Bạn đã đổi giờ nên cần chọn lại lựa chọn chia sẻ.',
  consentErrorEmpty: 'Hãy nhập ghi chú sức khoẻ, hoặc bỏ chọn ô này.',

  // S1: khối tóm tắt trước nút gửi (3.1.5)
  summaryTitle: 'Chia sẻ ghi chú sức khoẻ',
  summaryYes: (gymerName: string, untilText: string) => `Có, ${gymerName} xem đến ${untilText}`,
  summaryNo: 'Không',

  // S3: màn thành công (3.3)
  successRequestTitle: 'Đã gửi yêu cầu đặt lịch',
  successBody: (gymerName: string) =>
    `${gymerName} sẽ phản hồi trong vòng 24 giờ (hoặc trước giờ tập nếu sớm hơn). Bạn sẽ thấy kết quả khi Gymer xác nhận hoặc từ chối.`,
  successShared: (gymerName: string, untilText: string) =>
    `Ghi chú sức khoẻ: đã chia sẻ với ${gymerName} đến ${untilText}. Muốn dừng chia sẻ, hãy huỷ lịch trước giờ bắt đầu.`,
  successNotShared: (gymerName: string) => `Ghi chú sức khoẻ: không chia sẻ với ${gymerName}.`,
  successBackLabel: 'Về trang tìm kiếm',

  // Phía Gymer: khối ghi chú trong chi tiết yêu cầu (3.4)
  gymerSectionTitle: 'Ghi chú sức khoẻ',
  gymerSharedBadge: 'Khách chia sẻ',
  gymerViewableUntil: (untilText: string) =>
    `Bạn xem được ghi chú này đến ${untilText}, hoặc đến khi yêu cầu bị huỷ.`,
  gymerWarning: 'Chỉ dùng để chuẩn bị buổi tập an toàn. Đừng sao chép hay chia sẻ cho người khác.',
  gymerHiddenTitle: 'Không có ghi chú sức khoẻ được chia sẻ.',
  gymerHiddenHint: 'Ghi chú chỉ hiển thị khi khách đồng ý chia sẻ và trong thời hạn cho phép.',
  gymerLoadError: 'Không tải được ghi chú. Kiểm tra mạng rồi thử lại.',
  gymerRetry: 'Thử lại',
  gymerLoading: 'Đang tải ghi chú sức khoẻ...',
  gymerOpenDetail: 'Xem chi tiết',
  gymerDetailTitle: 'Chi tiết yêu cầu',
  gymerRequestNotFound: 'Không tìm thấy yêu cầu này.',
} as const;
