# Kiến trúc và bố cục dự án

## Thư mục

```text
affiliate-desk/
├── app/                  # Backend Python + giao diện web
│   ├── server.py         # API, auth, SQLite, AI, Android
│   ├── app.js            # Màn hình và tương tác người dùng
│   ├── index.html
│   └── style.css
├── desktop/              # Vỏ Electron, preload IPC, màn hình khởi động
├── scripts/              # Build runtime và sao lưu
├── tests/                # Backend, browser E2E, packaged desktop smoke
├── docs/                 # Hướng dẫn, QA, kiến trúc và phát hành
│   └── assets/           # Ảnh minh hoạ đã chọn để đưa vào tài liệu
├── deploy/               # Mẫu cấu hình server
├── licenses/             # Giấy phép thư viện đi kèm
├── .github/workflows/    # CI và build Windows
├── package.json
└── README.md
```

`node_modules/`, `runtime/`, `.build/`, `dist/`, `test-results/` là thư mục tự sinh, đã được Git bỏ qua. Database và file môi trường cũng bị bỏ qua. Không đặt dữ liệu khách hàng vào mã nguồn hoặc artifact kiểm thử.

## Hai chế độ vận hành

**Local:** Electron khởi chạy backend riêng ở `127.0.0.1` trên cổng ngẫu nhiên. Database nằm trong user data của app. Mã thiết lập chỉ điền sẵn cho trang local do chính app mở. UI đăng nhập và gọi API bằng bearer token.

**Đội ngũ:** UI desktop tải từ server CRM chung qua HTTPS. Backend CRM lưu dữ liệu chung; một bridge có token ngẫu nhiên ở loopback điều khiển Android tại máy nhân sự. Preload chỉ cung cấp hai thao tác: liệt kê thiết bị và mở cửa sổ scrcpy. Không mở quyền shell tuỳ ý cho trang web.

App đóng bridge/backend của chính nó bằng endpoint nội bộ có secret khi thoát. Secret này không được đưa vào mã UI hoặc database.

## Lưu trữ và đồng thời

SQLite chạy trên **một máy chủ**, không chia sẻ trực tiếp file SQLite qua ổ mạng. Record có `id`, `kind`, JSON data, `version`, `updated_at`. API kiểm tra phiên bản để tránh ghi đè cập nhật của người khác; kiểm tra liên kết brand–product–deal trước khi lưu/xoá. Có audit log theo user.

MVP dùng một database cho một agency. `owner_id` là người phụ trách công việc, không tạo giới hạn truy cập riêng. Cần thêm mô hình tenant và quyền theo nhóm nếu mở thành dịch vụ nhiều khách hàng.

## TikTok và AI

- Android giữ đăng nhập TikTok. CRM không lưu mật khẩu hoặc token TikTok.
- scrcpy truyền màn hình và thao tác. Không có dữ liệu hộp thư TikTok được đồng bộ vào SQLite.
- AI là request server-side tới OpenAI Responses API. Model và key nằm ở môi trường backend. Kết quả chỉ là bản nháp, không tự gửi.
- Product Radar và tự động liên hệ chỉ được thêm sau khi xác minh nguồn dữ liệu và quyền API thực tế.

## Hướng mở rộng

Có thể tách `Store`, `Devices` và phần AI khỏi `server.py` khi số tích hợp tăng. Giữ hợp đồng HTTP giữa UI và backend để thay SQLite bằng PostgreSQL mà không đổi luồng sử dụng. Automation nên có hàng đợi, idempotency, audit và cơ chế dừng trước khi thêm các tác vụ gửi ra ngoài.
