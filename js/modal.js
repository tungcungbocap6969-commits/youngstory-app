'use strict';

let _editId = null;

// ── Xóa báo cáo ──
window.delReport = async function (id) {
  if (!confirm('Xóa báo cáo này?')) return;
  const record = await dbGetById(id);
  if (record) {
    // Record tồn tại local → xóa local + Supabase qua sbId
    await dbDel(id);
    if (record.sbId) await sb.del(record.sbId).catch(e => console.warn('Supabase del:', e));
  } else {
    // Không có local → id chính là Supabase ID
    await sb.del(id).catch(e => console.warn('Supabase del:', e));
  }
  toast('Đã xóa bản ghi');
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
  await dbPut(updated);
  if (orig.sbId) {
    sb.update(orig.sbId, { worker_name: worker, team, process, quantity: qty })
      .catch(e => console.warn('Supabase update:', e));
  }
  closeModal();
  toast('Đã cập nhật báo cáo');
  loadToday();
  const hd = document.getElementById('hist-date').value;
  if (hd && currentTab === 'history') loadHistory(hd);
};

// Đóng modal khi bấm vào backdrop
document.getElementById('edit-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
