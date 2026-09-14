# Chuyển dữ liệu localStorage sang JSON server

Prototype cũ lưu khóa `renluyen_pth_v1` gồm `students`, `transactions`, `settings`. Ứng dụng mới không đọc localStorage khi vận hành.

Quy trình chuyển một lần:

1. Xuất giá trị `renluyen_pth_v1` thành file JSON từ trình duyệt cũ.
2. Validate version, học sinh, ngày, điểm và liên kết rule.
3. Chuyển học sinh/lớp sang các collection `students` và `classes`, đồng thời map ID cũ sang UUID mới.
4. Chuyển mỗi transaction cũ thành một phần tử `pointTransactions`. Giữ `batchId`; transaction không có batch nhận batch riêng.
5. Chuyển `voided` sang `VOIDED`, còn lại thành `ACTIVE`.
6. Ghi một `auditLogs` cho phiên chuyển và đối soát số học sinh, transaction, tổng cộng/trừ.
7. Tạo bản sao lưu `data/db.json` trước khi nhập. Nếu lỗi, phục hồi file này.

Import Excel/CSV về sau vẫn dùng luồng bảy bước hiện tại. Append bỏ trùng theo `tên chuẩn hóa + ngày sinh + lớp`; Replace archive danh sách active rồi thêm danh sách mới.

