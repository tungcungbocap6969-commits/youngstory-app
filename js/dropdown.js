'use strict';

// makeDropdownFrom — dropdown có danh sách động (updateList)
// inlineMode = true  → giá trị chọn hiển thị ngay trong ô input (dùng cho Tổ)
// inlineMode = false → giá trị hiển thị dưới dạng chip bên ngoài ô (dùng cho Công đoạn)
function makeDropdownFrom(sourceList, inputEl, listEl, chipWrap, afterSelect, inlineMode) {
  let selectedVal = '';
  let list = sourceList.slice();

  function filter(q) {
    const lq = q.toLowerCase().trim();
    return lq ? list.filter(p => p.toLowerCase().includes(lq)) : list;
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i))
      + '<span class="hi">' + esc(text.slice(i, i + q.length)) + '</span>'
      + esc(text.slice(i + q.length));
  }

  function renderList(opts, q) {
    listEl.innerHTML = '';
    if (!opts.length) {
      listEl.innerHTML = '<div class="dd-empty">Không tìm thấy</div>';
      return;
    }
    opts.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'dd-item';
      if (inlineMode && opt === selectedVal) div.classList.add('dd-item-selected');
      div.innerHTML = highlight(opt, q);
      div.addEventListener('mousedown',  e => { e.preventDefault(); pick(opt); });
      div.addEventListener('touchstart', e => { e.preventDefault(); pick(opt); }, { passive: false });
      listEl.appendChild(div);
    });
  }

  function open() {
    if (inlineMode && selectedVal) {
      selectedVal = '';
      inputEl.value = '';
    }
    renderList(filter(inputEl.value), inputEl.value);
    listEl.classList.add('open');
  }

  function close() { listEl.classList.remove('open'); }

  function pick(val) {
    selectedVal = val;
    close();
    if (inlineMode) {
      inputEl.value = val;
    } else {
      inputEl.value = '';
      renderChip(val);
    }
    if (afterSelect) afterSelect(val);
  }

  function renderChip(val) {
    if (!chipWrap) return;
    chipWrap.innerHTML = '';
    if (!val) return;
    chipWrap.innerHTML =
      `<div class="selected-chip">
         <span>${esc(val)}</span>
         <button class="chip-clear" type="button" aria-label="Bỏ chọn">×</button>
       </div>`;
    chipWrap.querySelector('.chip-clear').addEventListener('click', () => {
      selectedVal = '';
      renderChip('');
      inputEl.focus();
    });
  }

  inputEl.addEventListener('focus', open);
  inputEl.addEventListener('input', () => {
    renderList(filter(inputEl.value), inputEl.value);
    listEl.classList.add('open');
  });
  inputEl.addEventListener('blur', () => setTimeout(() => {
    if (inlineMode && selectedVal) inputEl.value = selectedVal;
    close();
  }, 160));

  return {
    get()              { return selectedVal; },
    set(val)           { selectedVal = val; if (inlineMode) inputEl.value = val; else renderChip(val); },
    clear()            { selectedVal = ''; inputEl.value = ''; if (!inlineMode) renderChip(''); },
    updateList(newList) { list = newList.slice(); },
  };
}
