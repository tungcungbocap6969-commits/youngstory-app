# CLAUDE.md — YoungStory Factory PWA

## Dự án là gì
PWA báo cáo sản lượng hàng ngày cho công nhân xưởng may **YoungStory**.
Công nhân nhập báo cáo ca trên điện thoại, dữ liệu lưu **cục bộ** vào IndexedDB.

---

## Ngôn ngữ & môi trường
- **Ngôn ngữ giao diện**: Tiếng Việt
- **Giao tiếp với tôi**: Tiếng Việt
- **Platform**: mobile-first, dark theme, PWA (offline-capable)
- **Không có bundler** — chạy thuần HTML/CSS/JS tĩnh
- **Server dev**: Node.js HTTP server tại `%TEMP%\xuong-server.js` (port 8080)
  - Khởi động: `Start-Process -FilePath "node" -ArgumentList "$env:TEMP\xuong-server.js" -WindowStyle Minimized`
  - URL: `http://localhost:8080`

---

## Cấu trúc file (sau refactor)
```
app xưởng/
├── index.html          — Bộ khung HTML (head + body, không inline CSS/JS)
├── manifest.json       — PWA manifest
├── sw.js               — Service worker (cache-first, cache name: 'xuong-sx-v2')
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── css/
│   ├── base.css        — Reset, design tokens (:root), scrollbar
│   ├── layout.css      — Header, main, bottom-nav, modal overlay, toast vị trí
│   ├── components.css  — Form, input, buttons, dropdown, cards, stats, install banner
│   ├── animations.css  — Tất cả @keyframes + animation class A-K
│   └── splash.css      — Màn hình splash (#splash và children)
└── js/
    ├── config.js       — Constants: TEAMS, PROCESSES_BY_TEAM, DB_NAME, MSK_OFFSET
    ├── db.js           — IndexedDB wrapper: openDB, dbAdd, dbGetByDate, dbGetById, dbPut, dbDel
    ├── time.js         — MSK time: mskNow, mskDateStr, mskTimeStr, isReportTime, secsToReport, tsToMSK, pad
    ├── utils.js        — Shared UI: esc(), toast(), countUp(), confetti()
    ├── dropdown.js     — makeDropdownFrom() factory (hỗ trợ inlineMode)
    ├── clock.js        — Clock tick, status banner (gọi setInterval mỗi 1s)
    ├── cards.js        — renderCard, tickCountdowns, loadToday, loadHistory
    ├── form.js         — Khởi tạo dropdown, submit handler, persistence (name/team)
    ├── modal.js        — Edit modal: openEdit, closeModal, saveEdit
    ├── splash.js       — Welcome text theo ngày + dismiss animation
    └── app.js          — Entry point: SW registration, tab navigation, init loadToday()
```

---

## Kiến trúc dữ liệu

### IndexedDB
- DB name: `xuong-sx`, version: 1
- Object store: `reports` (keyPath: `id` autoIncrement)
- Index: `date` (non-unique) — dùng để query theo ngày

### Record schema
```js
{
  id: number,          // auto
  workerName: string,
  team: string,        // Tổ sản xuất (xem TEAMS)
  process: string,     // Công đoạn
  quantity: number,
  date: string,        // 'YYYY-MM-DD' theo giờ Moscow
  timestamp: string    // ISO 8601 UTC
}
```

### localStorage
- `workerName` — tên công nhân (pre-fill khi mở lại)
- `selectedTeam` — tổ của họ (pre-fill + load đúng danh sách công đoạn)

---

## Quy tắc nghiệp vụ quan trọng

### Giờ Moscow (UTC+3)
```js
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
function mskNow() { return new Date(Date.now() + MSK_OFFSET_MS); }
// Luôn dùng getUTC*() sau khi cộng offset — KHÔNG dùng getHours() bình thường
```

### Khung giờ báo cáo
- Mốc: **20:30 MSK** mỗi ngày
- **Hiện tại**: `isReportTime()` trả về `true` (24/7 — chế độ test)
- Khi chốt: bỏ dòng `return true;`, bỏ comment phần logic gốc

### Cửa sổ chỉnh sửa
- **30 phút** sau khi gửi (`EDIT_WINDOW_MS = 30 * 60 * 1000`)
- Quá giờ → card hiển thị 🔒, không còn nút Chỉnh sửa / Xóa

### Tổ sản xuất & Công đoạn
```js
const TEAMS = ['Tổ quần', 'Tổ áo', 'Phòng cắt', 'Đóng gói', 'Quality Control (QC)'];
// Công đoạn được lọc theo tổ — cập nhật PROCESSES_BY_TEAM trong config.js khi có danh sách chính thức
```

---

## Các animation đã implement (tham chiếu)
| Ký hiệu | Tên | Trigger |
|---------|-----|---------|
| A | Clock glow | Mỗi giây đồng hồ MSK thay đổi |
| B | Brand shimmer | CSS infinite trên `.brand-label` |
| C | Qty input bounce | Khi nhập số lượng |
| D | Submit ripple | Khi bấm Gửi báo cáo |
| E | Confetti | Sau khi gửi thành công |
| F | Card slide-in | Mỗi card render (stagger 60ms) |
| G | Count-up qty | Số lượng trên card đếm từ 0 |
| H | Count-up stats | Tổng báo cáo / tổng sản lượng |
| I | Toast bounce | Mỗi thông báo |
| J | Progress bar | Đếm ngược 30 phút trên card |
| K | Tab fade-slide | Khi chuyển tab |

---

## Dropdown factory — makeDropdownFrom()

```js
makeDropdownFrom(sourceList, inputEl, listEl, chipWrap, afterSelect, inlineMode)
```

- **inlineMode = false** (mặc định): giá trị chọn hiển thị dạng chip bên ngoài ô input
- **inlineMode = true** (dùng cho Tổ): giá trị hiển thị ngay trong ô input, màu xanh lá; tap để reselect

---

## Splash screen
- Mẫu 1 ("Kim & Chỉ") — SVG animation, curtain-rise exit
- Welcome text: 25 câu, chọn theo `Math.floor(Date.now() / 86400000) % 25` → cùng ngày cùng câu
- Bật dismiss sau 800ms; tap bất kỳ để vào app

---

## PWA
- `manifest.json`: name "Xưởng Sản Xuất", short_name "Xưởng SX", display standalone
- Service worker: cache-first, phiên bản cache `xuong-sx-v2`
- **Khi cập nhật code**: bump cache name (v2 → v3, v4...) để người dùng nhận phiên bản mới

---

## Pending / Chưa làm
- [ ] Đồng bộ dữ liệu lên Google Sheets (deferred)
- [ ] Deploy Netlify — hướng dẫn đã viết riêng
- [ ] Cung cấp danh sách công đoạn chính thức → cập nhật `PROCESSES_BY_TEAM` trong `config.js`
- [ ] Bật lại giới hạn giờ báo cáo 20:30 MSK khi kết thúc test (xem `isReportTime()`)

---

## Preview files (không phải production)
- `mau-1.html`, `mau-2.html`, `mau-3.html` — các bản splash thử nghiệm
- `bg-a.html`, `bg-b.html`, `bg-c.html` — các bản background động thử nghiệm
