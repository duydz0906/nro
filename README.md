# ⚔ Linh Khí Online

Game nhập vai 2D nhiều người chơi, chạy trên trình duyệt, **mã nguồn mở và thế giới hoàn toàn nguyên bản** (tự viết code, tự vẽ đồ hoạ bằng Canvas, không sử dụng tài nguyên hay IP của bất kỳ game thương mại nào).

> **Lưu ý quan trọng:** dự án này **không phải** và không hỗ trợ dựng "bản lậu" / private server của Ngọc Rồng Online hay bất kỳ game có bản quyền nào. Đó là hành vi vi phạm pháp luật và điều khoản dịch vụ. Thay vào đó, đây là một game gốc cùng thể loại để bạn học tập, sửa đổi và phát triển tiếp.

---

## 🚀 Chạy nhanh

```bash
npm install
npm start
# Mở http://localhost:3000
```

- Vào **Chơi ngay** để tạo nhân vật khách và chơi lập tức (vẫn được lưu lại).
- Hoặc **Tạo tài khoản** để có nhân vật lâu dài (tài khoản đầu tiên trên máy chủ được cấp quyền quản trị).
- Chia sẻ link cho bạn bè để cùng vào một thế giới.

### Biến môi trường

| Biến    | Mặc định   | Ý nghĩa                                              |
| ------- | ---------- | ---------------------------------------------------- |
| `PORT`  | `3000`     | Cổng HTTP/WebSocket                                  |
| `HOST`  | `0.0.0.0`  | Địa chỉ lắng nghe                                    |
| `ADMIN` | *(trống)*  | Danh sách tên tài khoản quản trị, ví dụ `ADMIN=duy,a`|

Dữ liệu người chơi lưu tại `data/players.json` (tự động ghi mỗi 20 giây và khi thoát).

---

## 🎮 Tính năng

**Thế giới**
- 6 khu vực nối liền bằng cổng dịch chuyển: Làng Khởi Nguyên → Đồng Hoang → Rừng Trúc → Hang Sơn → Đỉnh Tuyết Sơn → Đấu Trường (PvP).
- Bản đồ được sinh theo thuật toán cố định (seed) — không cần file bản đồ, không cần asset.
- Hơn 120 quái vật sống động + 4 boss (Hổ Vương, Hồ Ly Vương, Thạch Ma Vương, Tuyết Sơn Lão Quái).
- Hiệu ứng môi trường: lá rụng, tuyết bay, đốm sáng trong hang, nước chảy, dung nham, cổng xoáy.

**Nhân vật**
- 4 môn phái: **Kiếm Tu** (cận chiến/đỡ đòn), **Pháp Tu** (phép thuật diện rộng), **Linh Y** (hồi phục/hỗ trợ), **Ẩn Tu** (đột kích/chí mạng).
- 4 chỉ số: Sức Mạnh, Thân Pháp, Thể Chất, Linh Lực — mỗi cấp được 3 điểm tự phân bổ.
- 12 kỹ năng (3 kỹ năng riêng mỗi phái): cận chiến, bắn xa, diện rộng nổ chậm, hồi máu, khiên/buff, lướt đánh, độc, làm chậm.

**Trang bị & kinh tế**
- 5 ô trang bị (vũ khí, áo, mũ, giày, nhẫn) × nhiều mẫu, 5 phẩm chất: Phẩm Thường → Tinh Luyện → Linh Khí → Sử Thi → Thần Khí.
- Cường hóa đến +15 tại thợ rèn (tỷ lệ giảm dần, mỗi cấp +9% chỉ số).
- Rơi đồ tự động, nhặt vàng tự động, cửa hàng bán đan dược, bán đồ lấy vàng.
- Đan dược: hồi sinh lực, hồi linh lực, phù trở về làng.

**Xã hội**
- Chat thế giới, chat riêng (`/w tên nội dung`), trả lời nhanh (`/r`), danh sách người online (`/who`), thông báo hệ thống.
- Lên cấp, hạ boss, vào/rời khu vực đều có thông báo cho mọi người.
- PvP tự do tại Đấu Trường.

**Máy chủ**
- Mô phỏng 20 tick/giây, gửi ảnh chụp trạng thái 16 lần/giây, dự đoán chuyển động + nội suy thực thể phía client để điều khiển mượt.
- Server là nguồn chân lý: mọi sát thương, rơi đồ, cấp độ đều do server quyết định.
- Tự động lưu, chống đăng nhập trùng, đo ping, mẹo định kỳ.

---

## ⌨️ Điều khiển

| Phím                     | Chức năng                                     |
| ------------------------ | --------------------------------------------- |
| `W A S D` / mũi tên      | Di chuyển                                     |
| Chuột trái (giữ)         | Tấn công liên tục về phía con trỏ             |
| Chuột trái vào quái      | Chọn mục tiêu                                 |
| `1 2 3` / `4`            | Kỹ năng 1–3 / đánh thường                     |
| `Tab`                    | Chọn quái gần nhất                            |
| `E`                      | Nói chuyện với NPC gần nhất                   |
| `B` `C` `K` `M` `H`      | Túi đồ · Nhân vật · Kỹ năng · Bản đồ · Trợ giúp|
| `Enter`                  | Mở chat · `Esc` đóng bảng                     |
| `N`                      | Bật/tắt âm thanh                              |

Lệnh chat: `/help` `/who` `/w <tên> <nội dung>` `/r <nội dung>` `/pos` `/time`
Thêm cho quản trị: `/ann` `/lv` `/gold` `/item` `/tp` `/heal` `/killall` `/admin <tên>`

---

## 🏗 Cấu trúc mã nguồn

```
shared/     Dữ liệu dùng chung server & client (bản đồ ô, vật phẩm, môn phái, kỹ năng, quái, công thức)
server/
  index.js  HTTP + WebSocket, xử lý gói tin, lệnh chat/quản trị, vòng lặp game
  world.js  Thế giới: va chạm, AI quái, chiến đấu, rơi đồ, đạn, vùng hiệu ứng, ảnh chụp trạng thái
  maps.js   Định nghĩa & sinh 6 bản đồ (MapBuilder), nén RLE gửi client
  player.js Nhân vật: chỉ số, túi đồ, trang bị, kinh nghiệm, buff/độc
  monster.js Quái vật
  save.js   Lưu trữ tài khoản (JSON, mật khẩu băm scrypt + muối)
  util.js   Hàm tiện ích
public/
  index.html, css/style.css
  js/art.js       Vẽ mọi thứ bằng Canvas 2D (ô bản đồ, nhân vật, quái, NPC, hiệu ứng)
  js/renderer.js  Camera, bản đồ nhỏ, thứ tự vẽ, ánh sáng, số sát thương
  js/game.js      Vòng lặp, nhập liệu, dự đoán chuyển động, xử lý sự kiện
  js/ui.js        HUD, chat, túi đồ, bảng nhân vật, cửa hàng, thông báo
  js/net.js       WebSocket + đo độ trễ
  js/state.js     Trạng thái & va chạm phía client
test/       Kiểm thử tự động (kết nối thật vào máy chủ + chạy client trong jsdom)
```

### Giao thức mạng (JSON qua WebSocket)

Client → server: `login` `register` `guest` `input` (bitmask) `atk` `sk` `chat` `use` `equip` `unequip` `sell` `buy` `enhance` `stat` `npc` `respawn` `ping`

Server → client: `welcome` `map` (RLE ô bản đồ) `s` (ảnh chụp 16 Hz: người chơi/quái/đồ rơi/đạn/sự kiện) `self` (chỉ số đầy đủ) `chat` `pickup` `xp` `died` `revive` `pong` `err`

---

## 🧪 Kiểm thử

```bash
npm test          # khởi động 2 máy chủ tạm và chạy toàn bộ
npm run test:play # chỉ chạy bộ kiểm thử luồng chơi (cần máy chủ đang chạy)
```

Bao gồm 31 kiểm thử: đăng nhập, đi qua cổng, đánh quái, kinh nghiệm, rơi đồ, chat, mua bán, đăng ký/đăng nhập lại, lệnh quản trị, trang bị, cường hóa, NPC… Ngoài ra `test/client-smoke.mjs` chạy chính mã nguồn giao diện trong DOM giả lập nối vào máy chủ thật để bắt lỗi runtime (cần cài thêm: `npm i -D jsdom`).

---

## 🛣 Hướng phát triển tiếp

- Nhiệm vụ (quest) & cốt truyện theo phe phái
- Tổ đội, bang hội, đấu trường xếp hạng
- Điều khiển cảm ứng cho điện thoại
- Thêm môn phái, kỹ năng, bản đồ & boss
- Lưu trữ bằng SQLite/Postgres thay cho JSON khi số người chơi lớn

## 📄 Giấy phép

MIT — bạn được tự do sử dụng, sửa đổi, phát hành. Chỉ xin đừng dùng mã này để dựng bản sao trái phép game của người khác.
