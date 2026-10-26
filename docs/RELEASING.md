# Phát hành và GitHub

Repository: [lenhatnam79/TikPhone-CRM](https://github.com/lenhatnam79/TikPhone-CRM). Tên ứng dụng hiện là Affiliate Desk; tên repo không làm đổi vị trí dữ liệu đã tạo trong app.

## Mã nguồn và artifact

Git chỉ chứa mã nguồn, test, tài liệu và ảnh minh hoạ. File cài đặt, runtime tải về, `node_modules`, database và API key không được commit. Các ZIP lớn được giữ trong thư mục `releases/TikPhone-CRM/<version>` ở bản bàn giao local hoặc artifact của GitHub Actions.

## Kiểm thử trên GitHub

Workflow **CI** chạy backend trên Ubuntu/Windows với Python 3.12 và 3.15, cùng browser E2E trên Ubuntu. Workflow **Build Windows** tải runtime chính thức, chạy backend test bằng chính Python được đóng gói, build ZIP và smoke test app Windows. Các workflow chạy khi push phù hợp vào `main`, hoặc chạy thủ công bằng nút Run workflow.

Chỉ coi kiểm thử Windows đã qua khi workflow của **đúng commit** thành công. Có workflow trong repo chưa đồng nghĩa bản app đã chạy tốt. Artifact Windows được giữ 7 ngày; tải về từ lần chạy thành công trên [Actions](https://github.com/lenhatnam79/TikPhone-CRM/actions).

## Build trên Mac

```sh
npm ci
python3 scripts/prepare_runtime.py --target mac
python3 -m venv .build-env
.build-env/bin/pip install -r requirements-build.txt
.build-env/bin/python scripts/build_backend.py
npm run build:mac
npm run test:desktop
```

Chạy trên Apple Silicon. Không chạy lại bộ kiểm thử desktop bằng database thật của người dùng. Script smoke tạo thư mục tạm và xoá sau khi kiểm thử.

## Quy trình cập nhật

1. Thay đổi trên branch riêng; giữ test phù hợp với hành vi đã sửa.
2. Tăng version trong `package.json` và `package-lock.json` nếu phát hành gói mới.
3. Chạy backend, browser và desktop tests liên quan.
4. Cập nhật `CHANGELOG.md` và `docs/TEST-REPORT.md` bằng bằng chứng thực tế.
5. Build gói mới, kiểm tra archive, ghi SHA-256; giữ các gói cũ theo version.

Bản 0.1.x là pilot nội bộ, chưa có chứng chỉ ký phát hành. Dữ liệu API key và database luôn được cấu hình ngoài repository.

Tài liệu nền: [GitHub — Python CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/python), [Playwright — CI](https://playwright.dev/docs/ci).
