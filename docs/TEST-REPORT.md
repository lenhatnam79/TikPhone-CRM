# Kết quả kiểm thử — Affiliate Desk 0.1.1

Ngày: 26/10/2026 (Asia/Ho_Chi_Minh).

## Đã xác minh

| Hạng mục | Kết quả | Phạm vi |
| --- | --- | --- |
| Backend unit/integration | **21/21 PASS** | Xác thực, bootstrap/UTF-8 với encoding Windows cũ, phiên hết hạn, phân quyền, workspace dùng chung, persistence, chống ghi đè, ràng buộc dữ liệu, bảo vệ xoá, kiểm tra URL/số/ngày, API nháp, device bridge, shutdown, reverse proxy |
| JavaScript syntax | **PASS** | UI, Electron main và preload |
| Browser E2E | **PASS** | Tạo workspace, đăng nhập, thêm/sửa brand–sản phẩm–cơ hội, tìm kiếm, mẫu tin, lưu nháp, thêm nhân sự, bảo vệ xoá, quyền member, reload giữ dữ liệu, bố cục 700px |
| Desktop Mac Apple Silicon | **PASS** | Chạy trực tiếp gói `.app`; tạo workspace lần đầu với mã được điền sẵn, đăng nhập, backend/runtime đi kèm, renderer sandbox, sao chép clipboard |
| CRM chung trong desktop | **PASS** | Backend độc lập trên localhost, desktop trỏ tới server chung, Android bridge vẫn chạy tại máy desktop |
| ADB và scrcpy trên Mac | **PASS ở mức công cụ** | scrcpy 5.0.1 chạy được; ADB khởi động và trả danh sách thiết bị; không có Android đang cắm |
| Sao lưu | **PASS** | Tạo backup, `PRAGMA integrity_check = ok`, bản ghi vẫn tồn tại trong backup |
| Build Windows x64 | **Đã đóng gói** | ZIP chứa Electron, Python Windows, UI/backend và ADB/scrcpy |

Kiểm thử desktop cố ý đặt đường dẫn Python ngoài app thành đường dẫn không tồn tại. App vẫn chạy bằng backend đóng gói, xác nhận không phụ thuộc Python cài sẵn cho phần vận hành local.

Lỗi timeout ở lần mở bản đóng gói đầu tiên đã được sửa bằng màn hình chờ và thời gian chờ khởi động phù hợp. Luồng first-run trên gói cuối đã qua kiểm thử.

## Chưa xác minh thực tế

- **Điện thoại và TikTok:** chưa có Android kết nối, chưa đăng nhập TikTok, chưa kiểm tra hộp thư, bàn phím tiếng Việt, gửi ảnh hoặc phiên làm việc dài. Không có tin nhắn nào được gửi tới brand.
- **AI thật:** chưa có API key/model để gọi dịch vụ. Đã kiểm thử parsing phản hồi giả lập và trạng thái chưa cấu hình. Mẫu tin hoạt động độc lập.
- **Windows:** gói đã build và kiểm tra thành phần, chưa được chạy trên hệ điều hành Windows.
- **Hạ tầng dùng chung:** đã thử trên localhost. Chưa triển khai server từ xa, DNS, chứng chỉ TLS hoặc kiểm thử qua mạng Internet.
- **Phát hành:** chưa ký bằng chứng chỉ phát hành Apple/Microsoft; chưa notarize. Đây là bản pilot nội bộ, không phải bản đã chứng nhận phát hành công khai.

## Môi trường

- macOS 13.0, Apple Silicon.
- Node.js 22.14.0; Electron 45.0.0; electron-builder 26.18.0.
- Backend/test Mac: Python 3.9.6; Mac backend đóng gói bằng PyInstaller 6.22.3.
- Windows embedded Python: 3.15.1.
- scrcpy 5.0.1, tải từ release chính thức, checksum SHA-256 khớp file checksum của dự án.
- Playwright chạy với Google Chrome có sẵn trên máy.

## Dữ liệu kiểm thử

Dữ liệu thử nghiệm được tạo trong database riêng/tạm và không đi kèm workspace mới. Ảnh preview dùng brand, sản phẩm, creator giả lập. Gói phát hành không chứa tài khoản mặc định, mật khẩu mẫu, token phiên hay API key.

Chi tiết lệnh chạy lại có trong README. Các script kiểm thử được bàn giao cùng mã nguồn.

## Rà soát 0.1.1 và GitHub

Mã nguồn đã được tổ chức lại theo app, desktop, docs, scripts, tests và workflows. Kiểm tra danh sách file Git không thấy database, runtime, gói cài đặt hoặc credential thật. Đã thêm CI và Windows build/smoke workflow; kết quả GitHub sẽ được cập nhật sau lần chạy của commit đã push.
