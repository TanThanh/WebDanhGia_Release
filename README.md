# Rèn luyện — Next.js + JSON

Ứng dụng quản lý điểm rèn luyện học sinh. Dữ liệu được lưu trong `data/db.json` phía server; không cần Docker, PostgreSQL hoặc localStorage.

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://127.0.0.1:31851`. Request đầu tiên tự tạo `data/db.json` với tài khoản quản trị nội bộ, settings mặc định và 41 quy tắc chính thức.

## Sao lưu

Tắt ứng dụng hoặc bảo đảm không có thao tác ghi, sau đó sao chép `data/db.json`. Không đặt nhiều instance ứng dụng cùng ghi vào một file.

## Kiểm tra

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

File quy tắc `data/point-rules.json` được sinh từ Excel chính thức bằng `scripts/extract-official-rules.mjs`; ứng dụng không cần file Excel gốc khi chạy.
