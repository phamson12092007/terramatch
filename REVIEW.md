# ACS.AEROTECH · SPA Basin UI review

## Chạy local bằng một lần bấm

Mở file `Run-Local.bat` ở thư mục dự án. File sẽ khởi động frontend tại `http://127.0.0.1:5173/` và mở trang trong trình duyệt. Nếu có `node_modules`, launcher chạy Vite ở chế độ phát triển; nếu thiếu, launcher dùng bản `frontend/dist` để mở bản xem trước tĩnh. Đóng cửa sổ server để dừng website.

Máy cần Node.js 20.19 trở lên. Nếu muốn chế độ phát triển mà chưa có dependency, cài Node.js kèm npm rồi dùng launcher để cài tự động từ `package-lock.json`; bản xem trước tĩnh không cần npm.

Mở [giao diện local](http://127.0.0.1:5173/). Bản TerraMatch trước đây vẫn có tại [/legacy](http://127.0.0.1:5173/legacy). Mã giao diện mới nằm trong [frontend/src/spa](frontend/src/spa).

Giao diện triển khai theo tài liệu `t_i_li_u_t_ng_h_p_k_thu_t_d_n_acs_aerotech.md` trong thư mục `D:\moon`:

- Mục tiêu South Pole–Aitken Basin và xe LTV.
- Ba chế độ Crewed EVA, Uncrewed Autonomous và Wheel & Suspension, với trọng số và tiêu chí trọng yếu riêng.
- Sáu vùng ứng viên của tài liệu, xếp hạng bằng công thức Gated Gaussian-Decay. Danh sách, ô H3, bản đồ và bảng điểm cập nhật khi đổi chế độ hoặc chọn địa điểm.
- Ô lục giác là H3 resolution 4 tính từ tọa độ của từng ứng viên. Tên mã `H3-SPA-01` trong tài liệu được giữ làm mã mẫu nội bộ. Mã H3 thực được hiển thị trong thẻ địa điểm.
- Nút Mars mở phần giới thiệu Jezero Crater theo đúng phạm vi mở rộng của tài liệu.
- Mặt cắt 10 km tải 11 điểm cao độ từ Open-Meteo/Copernicus DEM khi bấm nút, có thời hạn 2,5 giây và cache trên trình duyệt. Độ dốc hiển thị là trung bình theo mỗi đoạn 1 km.

## Giới hạn dữ liệu

Sáu ứng viên và các chỉ số địa chất, albedo, nhiệt độ, NDVI là bộ mẫu của tài liệu nhóm. Điểm số G-GD được tính trên bộ mẫu này. Bộ mẫu có NDVI để lọc thực vật và chưa có trường LandCover để xác nhận nước hoặc đô thị. Mặt cắt cao độ là yêu cầu API trực tiếp có nguồn riêng. Dữ liệu NASA POWER, SoilGrids, Macrostrat và lớp phủ đất chưa được tích hợp thành pipeline đo đạc. Vì vậy không dùng phần trăm hiện tại như kết quả khảo sát thực địa.

## Kiểm tra

- Build frontend với Vite.
- Chuyển chế độ LTV và xác nhận danh sách xếp hạng thay đổi.
- Chọn ứng viên và xác nhận bản đồ, mã H3 cùng bảng tiêu chí đổi theo.
- Tải mặt cắt 10 km cho Askja từ Open-Meteo, vẽ biểu đồ và lưu cache.
- Kiểm tra hộp Jezero Crater và bố cục responsive.

Nguồn bản đồ nền [Natural Earth](https://www.naturalearthdata.com/), lưới [H3](https://h3geo.org/docs/) và cao độ [Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api).

