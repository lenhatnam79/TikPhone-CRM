# Changelog

## 0.1.1 — 2026-10-26

- Đảm bảo log khởi động/mã thiết lập dùng UTF-8 khi Windows dùng encoding cũ.
- Đọc stdout/stderr backend theo UTF-8 ở Electron, tránh lỗi khi ký tự bị chia giữa các chunk.
- Gom hướng dẫn, kiến trúc, kiểm thử và phát hành vào `docs/`.
- Tách bản cài đặt khỏi mã nguồn; thêm CI đa hệ điều hành và workflow build/smoke test Windows.
- Cho phép tải runtime riêng cho Mac hoặc Windows để build gọn hơn.

## 0.1.0 — 2026-10-26

- MVP CRM: brand, sản phẩm, cơ hội, follow-up, phân công và audit.
- Tài khoản admin/member, đổi mật khẩu, kiểm tra xung đột cập nhật.
- Mẫu tin và tích hợp AI soạn nháp qua cấu hình backend.
- Electron Windows/Mac; điều khiển Android qua ADB/scrcpy.
- Chế độ local và server chung, cùng công cụ sao lưu SQLite.
