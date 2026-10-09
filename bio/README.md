# BioSpace · Firebase single-file starter

## Included
- `index.html`: giao diện và ứng dụng client chạy bằng Firebase JavaScript SDK 12.19.0.
- `database.rules.json`: Security Rules cho Realtime Database.
- `storage.rules`: Storage Rules để tải avatar/banner theo UID.

## Thiết lập bắt buộc trước khi đưa lên mạng
1. Trong Firebase Console của project `ideo-dd376`, mở **Authentication → Sign-in method** và bật **Email/Password**. Bật Google provider nếu muốn dùng nút Google.
2. Mở **Realtime Database → Rules**, nhập nội dung `database.rules.json` rồi Publish.
3. Mở **Storage** và khởi tạo bucket nếu project chưa bật dịch vụ. Sau đó dán nội dung `storage.rules` vào **Storage → Rules** rồi Publish.
4. Đưa `index.html` lên hosting HTTPS ở thư mục gốc tên miền. Khi chạy ở trang gốc, Bio có URL `https://tenmiencuaweb.site/#username` như yêu cầu.
5. Kiểm tra **Authorized domains** của Firebase Authentication để tên miền triển khai có trong danh sách.

## Dữ liệu được lưu ở đâu
- `users/{uid}`: thông tin tài khoản cơ bản.
- `profiles/{uid}`: bản nháp riêng của chủ tài khoản và snapshot đã xuất bản.
- `usernames/{username}`: giữ username duy nhất cho UID; chỉ người đăng nhập mới đọc được mapping.
- `publicProfiles/{username}`: dữ liệu đã xuất bản, đọc công khai.
- `analytics/{uid}/events/{eventId}`: các sự kiện xem/nhấp; dashboard chỉ tải tối đa 500 sự kiện gần nhất.
- `media/{uid}/...`: ảnh trong Firebase Storage.

## Lưu ý
- `index.html` dùng đúng cấu hình Firebase được cung cấp trong yêu cầu. Firebase Web API key là cấu hình client, không thay thế Security Rules.
- Các Rules cần được Publish riêng trong Firebase Console; tải file về không tự cài đặt chúng lên project.
- Analytics hiện ghi sự kiện từ client nên có thể bị bot hoặc người dùng cố tình làm sai lệch. Nếu cần số liệu chống spam ở quy mô lớn, hãy chuyển ghi nhận qua Cloud Functions và thêm App Check/rate limiting.
- URL có dấu `#` hoạt động cho điều hướng phía trình duyệt; phần username sau `#` không được gửi trong HTTP request ban đầu, vì vậy xem trước link/SEO riêng cho từng Bio có thể cần prerender hoặc backend bổ sung.
- File này triển khai luồng cốt lõi: email/password, đăng nhập Google tuỳ cấu hình, hồ sơ nháp, username duy nhất, links, social links, giao diện, avatar/banner, xuất bản/gỡ xuất bản và analytics cơ bản. Các module như trang quản trị đầy đủ, nhạc/video nhúng, QR và quy trình xóa tài khoản an toàn cần backend/policy riêng và chưa được coi là đã hoàn thành.
