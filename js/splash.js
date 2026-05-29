'use strict';

// ── Welcome text — thay đổi mỗi ngày ──
(function () {
  const WELCOME_MSGS = [
    'Mỗi đường kim là một tác phẩm — hôm nay cũng vậy.',
    'Bàn tay cần mẫn hôm nay, sản phẩm đẹp ngày mai.',
    'Từng mũi chỉ đều có giá trị riêng của nó.',
    'Làm tốt từng công đoạn, chất lượng tự nói lên.',
    'Đôi tay khéo léo dệt nên những điều tuyệt vời.',
    'Mỗi sản phẩm là dấu ấn của bạn — hãy tự hào.',
    'Cẩn thận từng đường may, chất lượng theo đó mà lên.',
    'Hôm nay cố thêm một chút — xứng đáng với công sức bỏ ra.',
    'Nghề may không chỉ là công việc — đó là nghệ thuật.',
    'Tinh thần tốt, tay nghề tốt — cả hai đều quan trọng.',
    'Mỗi ca làm việc là cơ hội thể hiện tài năng của bạn.',
    'Chăm chỉ hôm nay, tự hào khi nhìn lại ngày mai.',
    'Một mũi khâu cẩn thận hơn một trăm mũi vá sau.',
    'Cùng nhau làm tốt — cùng nhau thành công.',
    'Đều tay, đều chỉ — sản phẩm tự nhiên sẽ đẹp.',
    'Làm việc bằng cả trái tim, sản phẩm sẽ nói thay lời.',
    'Không có đường may nào là nhỏ — tất cả đều tạo nên tổng thể.',
    'Hôm nay bạn làm được nhiều hơn hôm qua.',
    'Mỗi sợi chỉ là một phần của câu chuyện bạn đang dệt.',
    'Tay nghề giỏi bắt đầu từ sự kiên nhẫn trong từng chi tiết.',
    'Làm đúng ngay từ đầu — tiết kiệm công sửa sau.',
    'Sản phẩm tốt là lời cảm ơn tốt nhất với nghề.',
    'Mỗi ngày là một trang mới — hôm nay hãy viết tốt.',
    'Bàn tay của bạn tạo ra thứ người khác trân trọng.',
    'Đường chỉ thẳng bắt đầu từ sự tập trung — hãy giữ vững.',
  ];

  // Cùng ngày thì mọi người thấy cùng câu
  const dayIndex = Math.floor(Date.now() / 86400000) % WELCOME_MSGS.length;
  const el = document.getElementById('sp-welcome-text');
  if (el) el.textContent = WELCOME_MSGS[dayIndex];
}());

// ── Dismiss splash khi tap/click ──
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;

  function dismiss() {
    splash.classList.add('exit');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }

  // Cho phép dismiss ngay khi chữ "Chạm để bắt đầu" xuất hiện (delay 4.2s + fade 1s)
  let ready = false;
  setTimeout(() => { ready = true; }, 5200);

  splash.addEventListener('click',      () => { if (ready) dismiss(); });
  splash.addEventListener('touchstart', () => { if (ready) dismiss(); }, { passive: true });
}());
