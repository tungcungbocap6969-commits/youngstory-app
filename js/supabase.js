'use strict';

const SUPABASE_URL = 'https://accjssimourrafwumltv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjY2pzc2ltb3VycmFmd3VtbHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDg0NjcsImV4cCI6MjA5MzgyNDQ2N30.Wv5UMMxGynKoU-I8I2fREf6vJET366Jf6oWpUk60ONU';

function _headers(extra) {
  return Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  }, extra);
}

const sb = {
  // Insert one record, return the saved row (with server-assigned id)
  async insert(row) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/reports', {
      method: 'POST',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    return rows[0];
  },

  // Patch a row by Supabase id
  async update(sbId, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/reports?id=eq.' + sbId, {
      method: 'PATCH',
      headers: _headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Delete a row by Supabase id
  async del(sbId) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/reports?id=eq.' + sbId, {
      method: 'DELETE',
      headers: _headers(),
    });
    if (!res.ok) throw new Error(await res.text());
  },

  // Get all records for a specific date (YYYY-MM-DD)
  async getByDate(date) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/reports?date=eq.' + date + '&order=timestamp.asc&limit=10000',
      { headers: _headers() }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Get all records between two dates (inclusive)
  async getRange(from, to) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/reports?date=gte.' + from + '&date=lte.' + to + '&order=timestamp.asc&limit=10000',
      { headers: _headers() }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Search workers by name (case-insensitive, partial match)
  async searchWorkers(query) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/workers?name=ilike.*' + encodeURIComponent(query) + '*&limit=10',
      { headers: _headers() }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Kiểm tra báo cáo trùng trong vòng 2 giờ (cùng tên + công đoạn + sản lượng)
  async checkDuplicate(workerName, process, quantity) {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/reports?worker_name=ilike.' + encodeURIComponent(workerName) +
      '&process=eq.' + encodeURIComponent(process) +
      '&quantity=eq.' + quantity +
      '&timestamp=gte.' + encodeURIComponent(since) + '&limit=1',
      { headers: _headers() }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return rows.length > 0;
  },

  // Get reports for a specific worker on a specific date
  async getByWorkerDate(name, date) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/reports?worker_name=ilike.' + encodeURIComponent(name) +
      '&date=eq.' + date + '&order=timestamp.desc&limit=1000',
      { headers: _headers() }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // ── Workers ──
  async getWorkers() {
    const res = await fetch(SUPABASE_URL + '/rest/v1/workers?order=name.asc', { headers: _headers() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async addWorker(worker) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/workers', {
      method: 'POST',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(worker),
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    return rows[0];
  },

  async updateWorker(id, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/workers?id=eq.' + id, {
      method: 'PATCH',
      headers: _headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
  },
};
