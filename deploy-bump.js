// Bump phiên bản cache (sw.js) + splash (index.html) — đọc/ghi UTF-8 chuẩn bằng Node.
// Thay cho lệnh PowerShell cũ vốn làm hỏng tiếng Việt (mojibake) mỗi lần chạy.
'use strict';
const fs = require('fs');

const sw = fs.readFileSync('sw.js', 'utf8');
const m = sw.match(/xuong-sx-v(\d+)/);
if (!m) { console.error('Không tìm thấy chuỗi phiên bản trong sw.js'); process.exit(1); }
const n = parseInt(m[1], 10) + 1;
const version = 'xuong-sx-v' + n;

fs.writeFileSync('sw.js', sw.replace(/xuong-sx-v\d+/g, version), 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/(class="sp-version">)v\d+/, '$1v' + n);
fs.writeFileSync('index.html', html, 'utf8');

process.stdout.write(version);
