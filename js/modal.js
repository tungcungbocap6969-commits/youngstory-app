'use strict';

let _editId = null;

// ── Xóa báo cáo ──
window.delReport = async function (id) {
  if (!confirm('Xóa báo cáo này?')) return;
  const record = await dbGetById(id);
  if (!record) {
    // Không có local (vd đang xem lịch sử từ server) → id chính là Supabase ID
    await sb.del(id).catch(e => console.warn('Supabase del:', e));
    toast('Đã xóa bản ghi');
  } else if (!record.sbId) {
    // Chưa từng lên server (đang chờ gửi) → xóa local là xong
    await dbDel(id);
    toast('Đã xóa bản ghi');
  } else {
    // Đã trên server → đánh dấu CHỜ XÓA, xóa qua hàng đợi (tự thử lại, không mất khi mạng kém)
    await dbPut({ ...record, pendingDelete: true });
    sendRecord(id);    // thử xóa ngay
    requestBgSync();   // và nhờ trình duyệt xóa tiếp kể cả khi đóng app
    toast('⏳ Đang xóa…');
  }
  loadToday();
  const hd = document.getElementById('hist-date').value;
  if (hd && currentTab === 'history') loadHistory(hd);
};

// ── Mở modal chỉnh sửa ──
window.openEdit = async function (id) {
  const r = await dbGetById(id);
  if (!r) { toast('Không tìm thấy bản ghi'); return; }
  _editId = id;
  document.getElementById('e-name').value = r.workerName;
  if (r.team) {
    editTeamDD.set(r.team);
    editDD.updateList(getProcessList(r.team));
  }
  editDD.set(r.process);
  document.getElementById('e-qty').value = r.quantity;
  document.getElementById('edit-overlay').classList.add('open');
};

// ── Đóng modal ──
window.closeModal = function () {
  document.getElementById('edit-overlay').classList.remove('open');
  _editId = null;
};

// ── Lưu chỉnh sửa ──
window.saveEdit = async function () {
  const worker  = document.getElementById('e-name').value.trim();
  const team    = editTeamDD.get();
  const process = editDD.get();
  const qty     = parseInt(document.getElementById('e-qty').value, 10);

  if (!worker || !team || !process || !qty || qty < 1) {
    toast('Vui lòng điền đầy đủ thông tin');
    return;
  }

  const orig = await dbGetById(_editId);
  if (!orig) { toast('Không tìm thấy bản ghi'); return; }

  const updated = { ...orig, workerName: worker, team, process, quantity: qty };
  if (orig.sbId) updated.needsUpdate = true; // cần đẩy thay đổi lên server (qua hàng đợi, có retry)
  await dbPut(updated);
  if (orig.sbId) { sendRecord(_editId); requestBgSync(); }
  closeModal();
  toast(orig.sbId ? '⏳ Đang cập nhật…' : 'Đã cập nhật báo cáo');
  loadToday();
  const hd = document.getElementById('hist-date').value;
  if (hd && currentTab === 'history') loadHistory(hd);
};

// Đóng modal khi bấm vào backdrop
document.getElementById('edit-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
