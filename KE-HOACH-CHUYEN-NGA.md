# KẾ HOẠCH HƯỚNG A — CHUYỂN BACKEND VỀ NGA

> Trạng thái: **CHỈ LÀ KẾ HOẠCH. KHÔNG thực thi cho tới khi chủ dự án ra lệnh.**
> Viết ngày 2026-06-06.

## 1. Mục tiêu
Đưa **phần dữ liệu (database + API) vào lãnh thổ Nga** để công nhân kết nối **nội địa**,
không còn vượt biên → **RKN không còn gì để bóp** → gửi báo cáo tức thì, 0% kẹt, không cần VPN.

App giao diện (GitHub Pages) **giữ nguyên** — cache-first đã lo phần tải app.

## 2. Kiến trúc đích
```
Công nhân (Nga)
   → api.youngstory.net   (vẫn dùng domain cũ, chỉ trỏ sang IP server NGA, DNS-only)
      → Backend đặt TRONG Nga (PostgreSQL + REST API)
```
Điểm lợi lớn: app **đã** gọi `api.youngstory.net` rồi → khi chuyển chỉ cần **trỏ lại DNS** sang server Nga.
Nếu giữ được API tương thích + cùng anon key → **app gần như không phải sửa gì**.

## 3. Hai phương án kỹ thuật

### Phương án A1 — Tự dựng Supabase (mã nguồn mở) trên VPS Nga
- API **giống hệt Supabase hiện tại** (cùng đường `/rest/v1/...`, cùng cơ chế anon key) → app đổi rất ít.
- **Nhược:** stack nặng (Postgres + Kong + PostgREST + GoTrue + ...). VPS cần **≥ 4GB RAM**.
  Bạn **tự vận hành mọi thứ** kể cả **sao lưu** database.

### Phương án A2 — Managed PostgreSQL + PostgREST  ⭐ khuyến nghị
- Thuê **Managed PostgreSQL** (Selectel/Timeweb) → nhà cung cấp lo **sao lưu, uptime, vá lỗi** database.
- Chạy **PostgREST** (nhẹ) + **Caddy** trên 1 VPS nhỏ để cho ra REST API + HTTPS.
- **Ưu:** gánh nặng vận hành thấp hơn nhiều (phần rủi ro nhất — backup DB — đã có người lo).
- **Nhược:** cần tinh chỉnh PostgREST cho khớp đường dẫn `/rest/v1/` và cơ chế key (có thể phải đổi anon key + sửa 1–2 dòng trong app).

## 4. Các bước thực hiện (theo Phương án A2)

### Bước 0 — Chuẩn bị
- [ ] Thuê **Managed PostgreSQL** ở Selectel hoặc Timeweb (vùng Moscow/SPb).
- [ ] Thuê **1 VPS nhỏ** cùng nhà cung cấp (chạy PostgREST + Caddy) — hoặc dùng chung nếu họ cho.
- [ ] Lấy: chuỗi kết nối PostgreSQL, IP VPS, SSH.

### Bước 1 — Dựng schema + di chuyển dữ liệu
- [ ] Xuất dữ liệu hiện tại từ Supabase: `pg_dump` 2 bảng `reports`, `workers` (cả cấu trúc + dữ liệu).
- [ ] Nạp vào PostgreSQL Nga: `psql` restore.
- [ ] **Đối chiếu số dòng** 2 bên cho khớp (chống mất dữ liệu).

### Bước 2 — Dựng API
- [ ] Cài PostgREST (Docker) trên VPS, trỏ tới Managed PostgreSQL.
- [ ] Cấu hình role `anon` + JWT secret (đặt cùng secret để **anon key cũ vẫn hợp lệ**, hoặc phát key mới).
- [ ] Cài **Caddy**: `api.youngstory.net` → PostgREST, thêm rewrite `/rest/v1/*`, tự HTTPS Let's Encrypt.
- [ ] Mở firewall (UFW) cổng 80/443 (bài học từ proxy Vultr).

### Bước 3 — Bảo mật
- [ ] Phân quyền: role `anon` chỉ được làm đúng việc app cần (insert/select/update reports trong cửa sổ, đọc workers...).
- [ ] Đảm bảo người lạ **không xóa/sửa bừa** được toàn bộ dữ liệu.

### Bước 4 — Test trước khi chuyển (KHÔNG đụng người dùng)
- [ ] Test GET/POST/PATCH/DELETE qua `https://<ip-tạm>` y như đã test proxy Vultr.
- [ ] Test từ một máy ở Nga (không VPN): gửi liên tiếp 10 báo cáo → đo tỷ lệ thành công + độ trễ.

### Bước 5 — Cutover (chuyển thật)
- [ ] Nếu anon key đổi → sửa `SUPABASE_URL`/`SUPABASE_KEY` trong `js/supabase.js` **và** `sw.js`, deploy.
- [ ] **Trỏ DNS** `api.youngstory.net` từ proxy Vultr → **IP server Nga** (DNS-only). TTL Auto nên lan nhanh.
- [ ] Theo dõi log + vài báo cáo thật.
- [ ] Ổn định → **gỡ proxy Vultr** (không cần nữa).

## 5. Vận hành MÃI MÃI (sau khi chuyển)
| Việc | A2 (Managed PG) |
|---|---|
| Trả tiền hằng tháng | Bạn (Managed PG + VPS nhỏ) |
| Sao lưu dữ liệu | **Nhà cung cấp lo** ✅ |
| Vá lỗi / uptime DB | Nhà cung cấp lo phần lớn |
| Cập nhật PostgREST/Caddy | Thỉnh thoảng (nhẹ) |
| SSL | Tự gia hạn (Caddy) |
| Giám sát | Bạn để mắt (server sập phải có người biết) |

→ **Không phải "chạy mãi không đụng tới"**, nhưng với Managed PG thì gánh nặng ở mức thấp.

## 6. Rủi ro & cách xử lý
- **Rollback:** giữ Supabase + proxy Vultr chạy song song trong lúc chuyển. Lỗi → trỏ DNS về lại Vultr.
  ⚠️ Lưu ý: sau khi cutover, báo cáo MỚI ghi vào DB Nga; nếu rollback phải đồng bộ ngược các bản ghi đó.
  → Giữ cửa sổ cutover ngắn + theo dõi sát.
- **Quản lý ở ngoài Nga:** truy cập server Nga từ nước ngoài (chiều vào) thường ổn; nếu lag thì manager bật VPN (số lượng ít).
- **Nhà cung cấp Nga:** chọn loại Managed để giảm rủi ro tự vận hành.

## 7. Trước khi RA LỆNH thực thi, cần chốt:
1. Chọn nhà cung cấp: **Selectel** hay **Timeweb**?
2. Phương án: **A2 (Managed PG + PostgREST)** ⭐ hay **A1 (tự dựng Supabase)**?
3. Chấp nhận gánh vận hành (dù thấp) đổi lấy 0% kẹt + không VPN?

> Khi chủ dự án nói "thực thi Hướng A", mới bắt đầu Bước 0.
