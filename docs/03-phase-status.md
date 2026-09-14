# Trạng thái triển khai JSON

## Phase 1 — Nền tảng: hoàn tất

- Next.js App Router, TypeScript và Tailwind CSS.
- JSON repository tự khởi tạo, ghi atomic và serialize thao tác ghi.
- 41 rule chính thức trong `data/point-rules.json`.

## Phase 2 — Nghiệp vụ: hoàn tất

- Import linh hoạt, append/replace, validate và chống trùng.
- Một batch chứa nhiều transaction riêng.
- Rule points được lấy phía server.
- Undo mềm và audit log.

## Phase 3 — UI: hoàn tất

- Sáu workspace, responsive, modal, spinning counter và export Excel.

## Phase 4 — Chất lượng

- Unit test, ESLint, TypeScript và production build.
- Smoke test API thực hiện trực tiếp với `data/db.json`, không cần dịch vụ ngoài.

