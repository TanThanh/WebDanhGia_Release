# Kiến trúc ứng dụng Rèn luyện

## Phạm vi

Ứng dụng phục vụ chuỗi: import học sinh → chọn quy tắc → chọn học sinh → ghi nhận điểm → theo dõi → báo cáo. Không mở rộng sang hệ thống quản lý trường học.

## Lưu trữ

Runtime dùng `data/db.json` trên server, không dùng Docker, SQL hoặc localStorage. File được tạo tự động ở request đầu tiên và chứa các collection tương đương:

- `students`
- `classes`
- `pointRules`
- `pointTransactions`
- `transactionBatches`
- `users`
- `auditLogs`
- `settings`
- `studentImports`

`src/lib/json-db.ts` là lớp truy cập duy nhất. Các lần ghi được xếp hàng trong process, ghi ra file tạm rồi rename để tránh file JSON dở dang.

## Cấu trúc project

```text
data/
  point-rules.json         # 41 quy tắc trích từ Excel chính thức
  db.json                  # tự sinh, dữ liệu runtime
src/
  app/api/                 # API import, ghi điểm, undo, settings, bootstrap
  components/              # desktop workspace
  lib/json-db.ts           # JSON repository + audit
  lib/normalization.ts     # header detection và mapping
  lib/scoring.ts           # tính điểm và xếp loại
scripts/
  extract-official-rules.mjs
tests/
docs/
```

## Bảo toàn nghiệp vụ

- Frontend chỉ gửi `ruleId`; API lấy số điểm từ `pointRules` trong JSON.
- Một lần ghi nhiều học sinh tạo một batch và N transaction riêng có cùng `batchId`.
- Undo đổi transaction từ `ACTIVE` sang `VOIDED`, không xóa bản ghi.
- Replace import archive học sinh cũ để giữ lịch sử.
- Import, ghi điểm, undo và thay đổi settings đều tạo audit log.

## Giới hạn chủ động

JSON phù hợp cho một process/server và quy mô nhỏ. Không nên đặt ứng dụng trên serverless hoặc chạy nhiều instance cùng dùng một file. Khi cần nhiều giáo viên ghi đồng thời trên nhiều máy chủ, có thể thay `json-db.ts` bằng PostgreSQL mà không cần đổi UI hay payload API.

