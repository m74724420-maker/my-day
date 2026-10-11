/* =============================================================
   ТВОЙ ДЕНЬ — логика сайта

   Разделы:
     1. Хранилище          6. ИИ и лимит запросов
     2. Темы оформления    7. Погода
     3. Дата и время       8. Новости
     4. Заметки            9. Сегодня в истории и интересное
     5. Архив, поиск,     10. Фон
        страховка
   ============================================================= */

'use strict';

/* =============================================================
   1. ХРАНИЛИЩЕ
   Всё, что вы пишете, лежит только в этом браузере.
   Никуда не отправляется.
   ============================================================= */

const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (e) { /* всё равно */ }
  }
};

/* =============================================================
   2. ТЕМЫ ОФОРМЛЕНИЯ
   ============================================================= */

const THEMES = [
  { id: 'warm',  name: 'тёплая',     dot: '#e08a2c' },
  { id: 'brown', name: 'коричневая', dot: '#6f4a34' },
  { id: 'beige', name: 'бежевая',    dot: '#a3936a' },
  { id: 'dark',  name: 'тёмная',     dot: '#d98b3f' }
];

function applyTheme(id) {
  const theme = THEMES.find(function (t) { return t.id === id; }) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  document.getElementById('themeName').textContent = theme.name;
  document.getElementById('themeDot').style.background = theme.dot;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim());
  }
  Store.set('td.theme', theme.id);
}

function initThemes() {
  applyTheme(Store.get('td.theme', 'warm'));
  document.getElementById('themeBtn').addEventListener('click', function () {
    const cur = document.documentElement.getAttribute('data-theme');
    const idx = THEMES.findIndex(function (t) { return t.id === cur; });
    applyTheme(THEMES[(idx + 1) % THEMES.length].id);
  });
}

/* =============================================================
   3. ДАТА И ВРЕМЯ
   ============================================================= */

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_N = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда',
                  'четверг', 'пятница', 'суббота'];

/* Время Москвы: телефон может быть в любой зоне, а сброс
   счётчика и «сегодня» должны считаться по Москве. */
function mskDate() {
  return new Date(Date.now() + 3 * 3600 * 1000);
}

/* Ключ дня. Кладём сдвиг на 4 часа: ночь с 0:00 до 4:00 ещё
   относится к вчерашнему дню. Так счётчик и заметки обнуляются
   в четыре ночи, а не в полночь. */
function dayKey() {
  const d = mskDate();
  d.setUTCHours(d.getUTCHours() - 4);
  return d.toISOString().slice(0, 10);
}

function dayKeyHuman(key) {
  const p = key.split('-');
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

/* Время суток по Москве. От него зависит плотность подложки
   под фотографией: утром она светлее, ночью плотнее.
   Раскладка под настроение, а не по часам. */
function dayPart(h) {
  if (h >= 5 && h < 12) return 'day';
  if (h >= 12 && h < 17) return 'day';
  if (h >= 17 && h < 23) return 'evening';
  return 'night';
}

function applyDayPart(part) {
  document.documentElement.setAttribute('data-daypart', part);
}

function showDate() {
  const d = mskDate();
  document.getElementById('todayStr').textContent =
    WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];

  /* крупная дата в шапке: число отдельно, месяц под ним */
  const bigNum = document.getElementById('bigDay');
  const bigMon = document.getElementById('bigMonth');
  if (bigNum) bigNum.textContent = d.getUTCDate();
  if (bigMon) bigMon.textContent = MONTHS_N[d.getUTCMonth()];

  const h = d.getUTCHours();
  applyDayPart(dayPart(h));
  let word;
  if (h >= 5 && h < 12) word = 'Доброе утро';
  else if (h >= 12 && h < 17) word = 'Добрый день';
  else if (h >= 17 && h < 23) word = 'Добрый вечер';
  else word = 'Доброй ночи';
  document.getElementById('greeting').textContent = word;
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* =============================================================
   4. ЗАМЕТКИ

   Заметка — это { title, text, at }.
   Заголовок необязателен: если его не заполнили, показываем
   первую строку самого текста. Без заголовков через месяц
   в заметках не разберёшься — это оказалось важно.
   ============================================================= */

function loadDay(key) {
  return Store.get('td.notes.' + key, []);
}
function saveDay(key, notes) {
  Store.set('td.notes.' + key, notes);
}

/* Все дни, в которых есть хоть одна заметка, — от новых к старым */
function allNoteDays() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf('td.notes.') === 0) {
      const key = k.slice('td.notes.'.length);
      const list = Store.get(k, []);
      if (list && list.length) out.push({ key: key, count: list.length });
    }
  }
  out.sort(function (a, b) { return b.key.localeCompare(a.key); });
  return out;
}

function noteTime(stamp) {
  const d = new Date(stamp);
  return 'в ' + String(d.getHours()).padStart(2, '0') + ':'
                + String(d.getMinutes()).padStart(2, '0');
}

function noteTitleOf(n) {
  if (n.title && n.title.trim()) return n.title.trim();
  const first = String(n.text || '').split('\n')[0].trim();
  return first.length > 46 ? first.slice(0, 46) + '…' : first;
}

function renderNotes() {
  const key = dayKey();
  const notes = loadDay(key);
  const list = document.getElementById('todoList');

  list.innerHTML = '';
  notes.forEach(function (note, i) {
    const li = document.createElement('li');

    const h = document.createElement('div');
    h.className = 'note-head';
    h.textContent = noteTitleOf(note);

    const body = document.createElement('div');
    body.className = 'note-text';
    body.textContent = note.text;

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = noteTime(note.at);

    li.appendChild(h);
    li.appendChild(body);
    li.appendChild(time);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Удалить заметку');
    del.addEventListener('click', function () {
      notes.splice(i, 1);
      saveDay(key, notes);
      renderNotes();
    });
    li.appendChild(del);

    list.appendChild(li);
  });

  document.getElementById('notesEmpty').hidden = notes.length > 0;
  const box = document.getElementById('dayCount');
  box.textContent = notes.length
    ? (notes.length + ' ' + plural(notes.length, 'запись', 'записи', 'записей'))
    : '';
}

/* Добавить заметку. title может быть пустым. */
function addNote(title, text) {
  const key = dayKey();
  const notes = loadDay(key);
  notes.push({ title: String(title || '').trim(), text: String(text || '').trim(), at: Date.now() });
  saveDay(key, notes);
  renderNotes();
}

/* =============================================================
   5. АРХИВ, ПОИСК И СТРАХОВКА

   Заметки старых дней никуда не девались — просто на них нечем
   было посмотреть. Теперь можно.
   ============================================================= */

function openArchive() {
  const panel = document.getElementById('archivePanel');
  const body = document.getElementById('archiveBody');
  const days = allNoteDays();

  if (!days.length) {
    body.innerHTML = '<p class="empty">Пока пусто. Записи появятся здесь, как только вы их сделаете.</p>';
  } else {
    body.innerHTML = '<div class="arch-days"></div>';
    const box = body.querySelector('.arch-days');
    days.forEach(function (d) {
      const isToday = d.key === dayKey();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'arch-day';
      const left = document.createElement('span');
      left.className = 'ad-date';
      left.textContent = dayKeyHuman(d.key) + (isToday ? '  · сегодня' : '');
      const right = document.createElement('span');
      right.className = 'ad-n';
      right.textContent = d.count + ' ' + plural(d.count, 'запись', 'записи', 'записей');
      b.appendChild(left);
      b.appendChild(right);
      b.addEventListener('click', function () { showDay(d.key); });
      box.appendChild(b);
    });
  }
  panel.hidden = false;
}

function closeArchive() {
  document.getElementById('archivePanel').hidden = true;
}

function showDay(key) {
  const body = document.getElementById('archiveBody');
  const notes = loadDay(key);
  const back = '<button class="mini-btn" type="button" id="archBack">← Все дни</button>';

  let html = '<div class="arch-head">' + back +
             '<h3>' + dayKeyHuman(key) + '</h3></div>';

  if (!notes.length) {
    html += '<p class="empty">В этот день заметок не было.</p>';
  } else {
    html += '<ul class="arch-notes"></ul>';
    notes.forEach(function (n) {
      html += '<li><div class="note-head">' + escHtml(noteTitleOf(n)) + '</div>' +
              '<div class="note-text">' + escHtml(n.text) + '</div>' +
              '<span class="time">' + noteTime(n.at) + '</span></li>';
    });
  }
  body.innerHTML = html;
  body.querySelector('#archBack').addEventListener('click', openArchive);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------------- поиск по всем заметкам ---------------- */

let searchTimer = null;

function runSearch(q) {
  const needle = q.trim().toLowerCase();
  const box = document.getElementById('searchRow');
  const list = document.getElementById('todoList');
  const count = document.getElementById('searchCount');
  const empty = document.getElementById('notesEmpty');

  if (!needle) {
    box.hidden = true;
    renderNotes();
    return;
  }

  box.hidden = false;
  const days = allNoteDays();
  const found = [];
  days.forEach(function (d) {
    loadDay(d.key).forEach(function (n) {
      const hay = ((n.title || '') + ' ' + (n.text || '')).toLowerCase();
      if (hay.indexOf(needle) >= 0) found.push({ day: d.key, note: n });
    });
  });

  count.textContent = found.length
    ? ('найдено: ' + found.length)
    : 'ничего не найдено';

  list.innerHTML = '';
  found.forEach(function (f) {
    const li = document.createElement('li');
    li.className = 'found';
    const h = document.createElement('div');
    h.className = 'note-head';
    h.textContent = noteTitleOf(f.note);
    const body = document.createElement('div');
    body.className = 'note-text';
    body.textContent = f.note.text;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = dayKeyHuman(f.day) + ' · ' + noteTime(f.note.at);
    li.appendChild(h);
    li.appendChild(body);
    li.appendChild(time);
    list.appendChild(li);
  });

  empty.hidden = found.length > 0;
  if (!found.length) {
    empty.textContent = 'По слову «' + needle + '» ничего не нашлось.';
    empty.hidden = false;
  }
}

function initSearch() {
  const input = document.getElementById('notesSearch');
  document.getElementById('btnSearch').addEventListener('click', function () {
    const row = document.getElementById('searchRow');
    row.hidden = !row.hidden;
    if (!row.hidden) { input.focus(); runSearch(input.value); }
    else { input.value = ''; renderNotes(); }
  });
  input.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { runSearch(input.value); }, 220);
  });
}

/* ---------------- страховка: всё в текст ---------------- */

function exportAll() {
  const days = allNoteDays();
  if (!days.length) {
    alert('Пока нет ни одной записи — страховать нечего.');
    return;
  }
  const lines = [];
  lines.push('ЗАМЕТКИ — Твой день');
  lines.push('выгружено ' + new Date().toLocaleString('ru-RU'));
  lines.push('всего дней: ' + days.length +
             ', записей: ' + days.reduce(function (a, d) { return a + d.count; }, 0));
  lines.push('');
  days.forEach(function (d) {
    lines.push('=== ' + dayKeyHuman(d.key) + ' ===');
    loadDay(d.key).forEach(function (n) {
      if (n.title && n.title.trim()) lines.push('# ' + n.title.trim());
      lines.push(n.text);
      lines.push('');
    });
    lines.push('');
  });
  const text = lines.join('\n');

  const panel = document.getElementById('archivePanel');
  const body = document.getElementById('archiveBody');
  body.innerHTML = '<div class="arch-head">' +
      '<button class="mini-btn" type="button" id="archBack">← Закрыть</button>' +
      '<h3>Страховка</h3></div>' +
      '<p class="card-sub">Скопируйте всё и сохраните, например, в письме или в файле. ' +
      'Если телефон потеряется, заметки останутся здесь.</p>' +
      '<button class="big-btn" id="copyAll" type="button">Скопировать всё</button>' +
      '<textarea class="export-box" id="exportBox" rows="14"></textarea>';
  panel.hidden = false;

  const box = body.querySelector('#exportBox');
  box.value = text;

  body.querySelector('#archBack').addEventListener('click', closeArchive);
  const btn = body.querySelector('#copyAll');
  btn.addEventListener('click', function () {
    box.select();
    box.setSelectionRange(0, text.length);
    let done = false;
    try { done = document.execCommand('copy'); } catch (e) { done = false; }
    if (!done && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Скопировано ✓';
        setTimeout(function () { btn.textContent = 'Скопировать всё'; }, 1600);
      });
      return;
    }
    btn.textContent = done ? 'Скопировано ✓' : 'Выделите текст и скопируйте';
    setTimeout(function () { btn.textContent = 'Скопировать всё'; }, 1600);
  });
  box.focus();
}

/* ---------------- сохранение ответа ИИ ---------------- */

function saveAnswer(question, answer) {
  addNote('Ответ ИИ', '— ' + question + '\n\n' + answer);
  const card = document.getElementById('cardDay');
  card.classList.add('flash');
  setTimeout(function () { card.classList.remove('flash'); }, 1200);
}

/* =============================================================
   6. СЕРВЕР, ИИ И ЛИМИТ

   Счёт считает сервер, а не телефон: очистка истории браузера
   его не обнуляет.
   ============================================================= */

const SERVER = 'https://rough-wind-6dd1.m74724420.workers.dev';
const FALLBACK_LIMIT = 10;   /* пока сервер недоступен */

function userId() {
  let id = Store.get('td.uid', '');
  if (!id) {
    id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    Store.set('td.uid', id);
  }
  return id;
}

function serverReady() {
  return /^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(SERVER);
}

async function serverGet(path) {
  const res = await fetch(SERVER + path, { method: 'GET', headers: { 'X-User-Id': userId() } });
  return await res.json();
}

async function serverAsk(question) {
  const res = await fetch(SERVER + '/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId() },
    body: JSON.stringify({ q: question })
  });
  return await res.json();
}

function paintLimit(left, total) {
  const card = document.getElementById('cardAi');
  /* Сервер присылает «сколько осталось», но не «сколько всего».
     Раньше код молча брал старое значение из телефона, и цифра
     на экране замирала. Теперь: если остаток пришёл — верим ему. */
  const hasLeft = left !== undefined && left !== null;
  const n = hasLeft ? left : Store.get('td.used.' + dayKey(), 0);
  const all = (total === undefined || total === null) ? FALLBACK_LIMIT : total;

  document.getElementById('limitLeft').textContent = n;
  document.getElementById('limitAll').textContent = all;

  const done = n <= 0;
  card.classList.toggle('limit-done', done);
  const btn = document.getElementById('askBtn');
  if (btn) btn.disabled = done;

  const old = card.querySelector('.limit-msg');
  if (done && !old) {
    const msg = document.createElement('div');
    msg.className = 'limit-msg';
    msg.innerHTML = '<b>Запросы на сегодня закончились.</b><br>' +
      'Следующие десять — завтра после четырёх ночи по Москве. ' +
      'Так инструмент остаётся инструментом, а не болтовней.';
    card.appendChild(msg);
  }
  if (!done && old) old.remove();
}

async function syncLimit() {
  if (!serverReady()) { paintLimit(); return; }
  try {
    const data = await serverGet('/status');
    if (data && data.ok) paintLimit(data.left, data.total);
  } catch (e) {
    paintLimit();
  }
}

function bubble(text, who) {
  const log = document.getElementById('aiLog');
  const b = document.createElement('div');
  b.className = 'bubble bubble-' + who;
  b.textContent = text;
  log.appendChild(b);
  return b;
}

let asking = false;

async function askQuestion() {
  if (asking) return;
  const input = document.getElementById('askInput');
  const text = input.value.trim();
  if (!text) return;

  asking = true;
  const btn = document.getElementById('askBtn');
  btn.disabled = true;

  bubble(text, 'me');
  input.value = '';
  input.style.height = 'auto';
  const wait = bubble('Думаю…', 'ai');
  wait.classList.add('bubble-wait');

  try {
    if (!serverReady()) {
      await new Promise(function (r) { setTimeout(r, 700); });
      wait.classList.remove('bubble-wait');
      wait.textContent = 'Сервер ещё не подключён.';
      paintLimit();
      return;
    }

    const data = await serverAsk(text);

    if (data && data.ok) {
      wait.classList.remove('bubble-wait');
      wait.textContent = data.text;
      attachSave(wait, text, data.text);
      paintLimit(data.left, data.total);
      return;
    }
    if (data && data.error === 'limit') {
      wait.remove();
      paintLimit(0, data.total || FALLBACK_LIMIT);
      return;
    }
    wait.classList.remove('bubble-wait');
    wait.textContent = (data && data.message) || data.error || 'Не получилось получить ответ.';
    syncLimit();
  } catch (e) {
    wait.classList.remove('bubble-wait');
    wait.textContent = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  } finally {
    asking = false;
    if (btn) btn.disabled = document.getElementById('cardAi').classList.contains('limit-done');
  }
}

/* Кнопка «сохранить» под каждым ответом: чтобы взять нужное,
   а не тащить весь разговор в заметки. */
function attachSave(node, question, answer) {
  if (node.querySelector('.save-note')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'save-note';
  b.textContent = 'Сохранить в заметки';
  b.addEventListener('click', function () {
    saveAnswer(question, answer);
    b.textContent = 'Сохранено ✓';
    setTimeout(function () { b.textContent = 'Сохранить в заметки'; }, 1600);
  });
  node.appendChild(b);
}

function initAsk() {
  const input = document.getElementById('askInput');
  document.getElementById('askBtn').addEventListener('click', askQuestion);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) askQuestion();
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });
  syncLimit();
}

/* =============================================================
   7. ПОГОДА
   ============================================================= */

function paintWeather(w) {
  document.getElementById('wTemp').textContent = w.temp + '°';
  document.getElementById('wTemp').classList.remove('empty');
  document.getElementById('wDesc').textContent = w.icon + ' ' + w.text;
  document.getElementById('wFeel').textContent = 'ощущается ' + w.feels + '°';
  document.getElementById('wWind').textContent = 'ветер ' + w.wind + ' м/с';

  const box = document.getElementById('weatherDays');
  box.innerHTML = '';
  w.days.forEach(function (d) {
    const el = document.createElement('div');
    el.className = 'w-day';
    const hi = document.createElement('div'); hi.className = 'hi'; hi.textContent = d.hi + '°';
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = d.icon;
    const lo = document.createElement('div'); lo.className = 'lo'; lo.textContent = d.lo + '°';
    const nm = document.createElement('div'); nm.className = 'd'; nm.textContent = d.day;
    el.appendChild(nm); el.appendChild(ic); el.appendChild(hi); el.appendChild(lo);
    box.appendChild(el);
  });
}

async function loadWeather() {
  const desc = document.getElementById('wDesc');
  if (!serverReady()) return;
  try {
    const j = await serverGet('/weather');
    if (j && j.ok) paintWeather(j.weather);
    else desc.textContent = (j && j.error) || 'погода временно недоступна';
  } catch (e) {
    desc.textContent = 'нет связи с сервером';
  }
}

/* =============================================================
   8. НОВОСТИ С ВЫБОРОМ ТЕМ

   Темы отмечаются галочками и запоминаются. Если отметить
   слишком много, новостей будет не разобрать.
   ============================================================= */

/* Темы оставил только те, где нашлись живые ленты. Истонию и
   космос убрал: русских RSS, которые отдавали бы именно этот
   раздел, не нашлось — ТАСС, Hi-News и Naked Science по любой
   ссылке возвращают общую ленту. Пустой раздел хуже, чем
   его отсутствие. История и космос теперь живут в карточке
   «Сегодня в истории». */
const NEWS_CATS = [
  { id: 'science', name: 'наука' },
  { id: 'art',     name: 'искусство' },
  { id: 'tech',    name: 'технологии' }
];

/* Какие темы выбраны.

   Раньше здесь просто возвращалось что лежит в хранилище. Из-за
   этого кнопки «не работали»: темы со временем убирали и
   добавляли, а в хранилище оставались старые названия. Тогда
   на экране появлялся раздел, которого нет в списке кнопок, и
   нажать на кнопку было нельзя — лимит тем уже как будто
   выбран. Теперь пересекаем сохранённое с тем, что есть
   на самом деле, и чистим испорченное хранилище. */
function chosenCats() {
  const valid = NEWS_CATS.map(function (c) { return c.id; });
  const saved = Store.get('td.cats', null);

  if (!Array.isArray(saved)) return ['science', 'art'];

  const kept = saved.filter(function (id) { return valid.indexOf(id) >= 0; });

  /* убираем повторы — иначе лимит тем считается неверно */
  const uniq = [];
  kept.forEach(function (id) {
    if (uniq.indexOf(id) < 0) uniq.push(id);
  });

  if (!uniq.length) return ['science', 'art'];

  if (uniq.length !== saved.length) Store.set('td.cats', uniq);
  return uniq;
}

let hintTimer = null;

function renderTopicPicker() {
  const box = document.getElementById('newsTopics');
  box.innerHTML = '';
  const cur = chosenCats();
  NEWS_CATS.forEach(function (c) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'topic' + (cur.indexOf(c.id) >= 0 ? ' on' : '');
    b.textContent = c.name;
    b.addEventListener('click', function () {
      const list = chosenCats().slice();
      const i = list.indexOf(c.id);

      if (i >= 0) {
        /* Последнюю тему снять нельзя: иначе раздел останется
           пустым и будет выглядеть поломанным. */
        if (list.length === 1) {
          b.classList.add('topic-deny');
          setTimeout(function () { b.classList.remove('topic-deny'); }, 600);
          return;
        }
        list.splice(i, 1);
      } else {
        /* Больше трёх тем — каша, в сводке не разберёшь.
           Раньше кнопка просто молча не срабатывала, и её
           считали сломанной. Теперь показываем, что нельзя. */
        if (list.length >= 3) {
          const hint = document.getElementById('topicHint');
          hint.textContent = 'Уже выбрано три темы — снимите одну, чтобы добавить другую.';
          hint.hidden = false;
          clearTimeout(hintTimer);
          hintTimer = setTimeout(function () { hint.hidden = true; }, 3200);
          b.classList.add('topic-deny');
          setTimeout(function () { b.classList.remove('topic-deny'); }, 600);
          return;
        }
        list.push(c.id);
      }
      Store.set('td.cats', list);
      renderTopicPicker();
      loadNews();
    });
    box.appendChild(b);
  });
}

async function loadNews() {
  const list = document.getElementById('newsList');
  const sub = document.getElementById('newsSub');
  if (!serverReady()) { list.innerHTML = '<p class="empty">Пока пусто — раздел в работе.</p>'; return; }

  const cats = chosenCats().join(',');
  try {
    const j = await serverGet('/news?cats=' + encodeURIComponent(cats));
    if (!j || !j.ok) {
      list.innerHTML = '<p class="empty">' + escHtml((j && j.error) || 'Новости временно недоступны') + '</p>';
      return;
    }
    const n = j.news;
    let html = '';
    cats.split(',').forEach(function (id) {
      const items = (n[id] || []);
      const name = (NEWS_CATS.find(function (c) { return c.id === id; }) || {}).name || id;
      html += '<h3 class="fr-news-head">' + escHtml(name) + '</h3>';
      html += items.length
        ? items.map(function (x) {
            /* Английский заголовок помечаем, чтобы он не
               читался как русский и его можно было отличить
               от отечественных новостей. */
            const mark = x.lang === 'en' ? '<span class="news-lang">en</span>' : '';
            return '<a class="news-item" href="' + x.link + '" target="_blank" rel="noopener">' +
              '<span class="news-title">' + escHtml(x.title) + mark + '</span>' +
              '<span class="news-src">' + escHtml(x.source) + '</span></a>';
          }).join('')
        : '<p class="empty">По этой теме пока пусто.</p>';
    });
    list.innerHTML = html;
    translateEnglishHeadings();
    const when = new Date(n.updated);
    sub.textContent = 'Обновлено в ' + String(when.getHours()).padStart(2, '0') + ':' +
                    String(when.getMinutes()).padStart(2, '0') +
                    '. Нажмите на заголовок — откроется источник.';
  } catch (e) {
    list.innerHTML = '<p class="empty">нет связи с сервером</p>';
  }
}

/* =============================================================
   10. ПЕРЕВОД АНГЛИЙСКИХ ЗАГОЛОВКОВ

   Заголовки западных лент показываем сразу по-английски, а
   перевод подставляем следом — так раздел не пустует, пока
   сервер думает. Если перевод не пришёл, остаётся оригинал.
   ============================================================= */

let translating = false;

async function translateEnglishHeadings() {
  if (translating || !serverReady()) return;

  const nodes = [...document.querySelectorAll('.news-lang')]
    .map(function (m) { return m.parentNode; })
    .filter(function (el) { return el && !el.dataset.translated; });

  if (!nodes.length) return;

  const titles = nodes.map(function (el) {
    /* убираем саму пометку «en», она нам не нужна в запросе */
    const clone = el.cloneNode(true);
    const mark = clone.querySelector('.news-lang');
    if (mark) mark.remove();
    return clone.textContent.trim();
  });

  translating = true;
  try {
    const res = await fetch(SERVER + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId() },
      body: JSON.stringify({ items: titles })
    });
    const j = await res.json();

    if (j && j.ok && Array.isArray(j.items)) {
      nodes.forEach(function (el, i) {
        const ru = j.items[i];
        if (!ru) return;
        el.dataset.translated = '1';
        /* если перевод совпал с оригиналом, метку не трогаем */
        if (ru === titles[i]) return;
        el.innerHTML = '<span class="news-lang">en</span>' + escHtml(ru);
      });
    }
  } catch (e) {
    /* нет связи — оставляем английский, он лучше пустоты */
  } finally {
    translating = false;
  }
}

/* =============================================================
   9. СЕГОДНЯ В ИСТОРИИ И ЛЮБОПЫТНОЕ

   Данные лежат в interest.js — это обычный текст, без сети.
   Так надёжнее: работает всегда, даже если сервер занят.
   ============================================================= */

function factUrl(title) {
  return 'https://ru.wikipedia.org/wiki/' + encodeURIComponent(String(title).replace(/ /g, '_'));
}

/* Порядок выбора зависит от номера дня, поэтому «другая»
   меняет счётчик, и карточка не прыгает сама при обновлении. */
function pickOne(arr, offset) {
  if (!arr.length) return null;
  const n = parseInt(dayKey().replace(/-/g, ''), 10) || 1;
  return arr[(n + (offset || 0)) % arr.length];
}

/* Выбор по дате. Список покрывает не все дни года, поэтому
   сперва ищем запись, совпадающую с сегодняшним числом и месяцем,
   и только если её нет — берём по кругу. Иначе карточка
   показывала бы «2 сентября» десятого октября. */
function todayLabel() {
  const d = mskDate();
  return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
}

function renderToday(offset) {
  const box = document.getElementById('todayBody');
  const list = (typeof INTEREST_TODAY !== 'undefined') ? INTEREST_TODAY : [];
  if (!list.length) { box.innerHTML = '<p class="empty">Пока пусто.</p>'; return; }

  const want = todayLabel();
  let item = list.find(function (x) { return x.date === want; });

  if (!item) {
    let i = list.findIndex(function (x) { return x.date === want; });
    if (i < 0) {
      const n = parseInt(dayKey().replace(/-/g, ''), 10) || 1;
      i = (n + (offset || 0)) % list.length;
    }
    item = list[i];
    /* Показываем чужую дату только с честной пометкой,
       чтобы не выдавать её за сегодняшнюю. */
    item = { date: want, title: item.title, text: item.text, wiki: item.wiki,
             near: true };
  } else if (offset) {
    item = list[(list.indexOf(item) + offset) % list.length];
    item = { date: want, title: item.title, text: item.text, wiki: item.wiki,
             near: true };
  }

  box.innerHTML =
      '<div class="fact-date">' + escHtml(item.date) +
        (item.near ? ' · не точно на сегодня' : '') + '</div>' +
      '<div class="fact-title">' + escHtml(item.title) + '</div>' +
      '<p class="fact-text">' + escHtml(item.text) + '</p>' +
      '<a class="fact-link" href="' + factUrl(item.wiki) + '" target="_blank" rel="noopener">' +
        'Подробнее в Википедии →</a>';
}

function renderFact(offset) {
  const box = document.getElementById('factBody');
  const list = (typeof INTEREST_FACTS !== 'undefined') ? INTEREST_FACTS : [];
  const item = pickOne(list, offset);
  if (!item) { box.innerHTML = '<p class="empty">Пока пусто.</p>'; return; }
  box.innerHTML =
      '<div class="fact-kind">' + escHtml(item.kind) + '</div>' +
      '<div class="fact-title">' + escHtml(item.title) + '</div>' +
      '<p class="fact-text">' + escHtml(item.text) + '</p>' +
      '<a class="fact-link" href="' + factUrl(item.wiki) + '" target="_blank" rel="noopener">' +
        'Подробнее в Википедии →</a>';
}

/* =============================================================
   10. ФОН
   ============================================================= */

/* Фоны: дворцы, готика, скульптуры, осень и картины.
   kind — светлый снимок или тёмный: по нему решается,
   насколько плотно класть цвет темы поверх фотографии.
   Название показывается под миниатюрой, иначе непонятно,
   что за снимок выбран. */
const BACKDROPS = [
  { file: '01-chambord-night.jpg',    kind: 'dark',  name: 'Шамбор ночью' },
  { file: '11-autumn-park.jpg',       kind: 'light', name: 'Осень в парке' },
  { file: '08-venus.jpg',             kind: 'light', name: 'Венера Милосская' },
  { file: '04-notredame.jpg',         kind: 'dark',  name: 'Нотр-Дам' },
  { file: '12-autumn-leaves.jpg',     kind: 'light', name: 'Осенние листья' },
  { file: '02-chambord.jpg',          kind: 'light', name: 'Шамбор днём' },
  { file: '06-chartres.jpg',          kind: 'dark',  name: 'Шартрский витраж' },
  { file: '13-autumn-park-nyc.jpg',   kind: 'light', name: 'Нью-Йорк осенью' },
  { file: '09-nike.jpg',              kind: 'dark',  name: 'Ника Самофракийская' },
  { file: '03-neuschwanstein.jpg',    kind: 'light', name: 'Нойшванштайн' },
  { file: '10-versailles.jpg',        kind: 'dark',  name: 'Версаль' }
];

/* ---------------- КАРТИНЫ ----------------

   Викисклад заблокировал компьютер, и скачать картины
   оттуда не вышло. Поэтому сделано так: список картин
   задан здесь, но в сетку попадают только те, что реально
   лежат в папке img.

   Как это работает: страница проверяет каждый файл и
   молча убирает из списка те, которых нет. Значит можно
   сохранить картины под любыми именами из этого списка
   (или даже под другими — тогда подпись будет общей),
   и сайт сам их подхватит, без правки кода.

   Подсказка: сохраняйте именно картинку, а не страницу.
   Если сохранить страницу целиком, получится файл .htm
   или .jpg внутри HTML, и картинка не откроется. */
const PAINTINGS = [
  { file: '20-monet-waterlilies.jpg',      name: 'Моне. Кувшинки' },
  { file: '21-vangogh-starrynight.jpg',    name: 'Ван Гог. Звёздная ночь' },
  { file: '22-hokusai-wave.jpg',           name: 'Хокуси. Волна' },
  { file: '23-vermeer-girl.jpg',           name: 'Вермеер. Девушка с жемчугом' },
  { file: '24-klimt-kiss.jpg',             name: 'Климт. Поцелуй' },
  { file: '25-hogen-tahiti.jpg',           name: 'Гоген. Таити' },
  { file: '26-rembrandt-nightwatch.jpg',   name: 'Рембрандт. Ночной дозор' },
  { file: '27-dali-persistence.jpg',       name: 'Дали. Постоянство памяти' },
  { file: '28-recognizable-leonardo.jpg',  name: 'Да Винчи. Джоконда' },
  { file: '29-caravaggio-tenebrism.jpg',   name: 'Караваджо. Сомнение Фомы' },
  { file: '30-shishkin-morning.jpg',       name: 'Шишкин. Утро в соснах' },
  { file: '31-turner-snowstorm.jpg',       name: 'Тёрнер. Снежная буря' }
];

/* Тёмная картина нужна там, где она почти вся в тёмных
   тонах. Иначе подложка будет недостаточной. */
const DARK_PAINTS = [
  '21-vangogh-starrynight.jpg', '23-vermeer-girl.jpg',
  '26-rembrandt-nightwatch.jpg', '28-recognizable-leonardo.jpg',
  '29-caravaggio-tenebrism.jpg'
];

/* Фон подставляется плавно, без мигания: сначала новая
   фотография грузится отдельно и только потом становится
   фоном. Иначе при смене снимка на секунду виден пустой слой. */
function showBackdrop(pick) {
  const layer = document.getElementById('backdrop');
  const tint = document.querySelector('.backdrop-tint');
  if (!layer) return;

  const img = new Image();
  img.onload = function () {
    layer.style.backgroundImage = 'url(img/' + pick.file + ')';
    layer.classList.add('loaded');
    if (tint) tint.classList.toggle('soft', pick.kind === 'dark');
  };
  img.onerror = function () {
    /* снимок не загрузился: показываем одноцветный фон,
       чтобы страница не осталась пустой */
    layer.style.backgroundImage = '';
    layer.classList.add('loaded');
    if (tint) tint.classList.remove('soft');
  };
  /* без обёртки url(): иначе браузер ищет файл «url(img/…)» */
  img.src = 'img/' + pick.file;
}

/* ---------------- ФОНЫ ----------------

   Фон меняется сам каждый день: номер дня делится на
   количество снимков с остатком. Выбранный вручную
   заменяет дневной и запоминается; кнопка «как сегодня»
   возвращает дневной выбор.

   Список один — и для съёмок, и для картин: пользователю
   не нужно знать, где что. */

/* Собираем всё, что может быть фоном. Картины пока
   добавлены в конец и не должны сдвигать номера уже
   выбранных снимков: если картина встанет в середину,
   сохранённый выбор уедет на другой снимок. */
function allBackgrounds() {
  const base = BACKDROPS.slice();
  PAINTINGS.forEach(function (p) {
    base.push({
      file: p.file,
      name: p.name,
      kind: DARK_PAINTS.indexOf(p.file) >= 0 ? 'dark' : 'light'
    });
  });
  return base;
}

let BG = BACKDROPS;

function todayBackdropIndex() {
  const n = parseInt(dayKey().replace(/-/g, ''), 10);
  return n % BG.length;
}

function currentBackdrop() {
  const saved = parseInt(Store.get('td.pic', ''), 10);
  if (saved >= 0 && saved < BG.length) return saved;
  return todayBackdropIndex();
}

/* Рисуем сетку и даём выбрать любую.

   Проверка файлов идёт через onload/onerror самого браузера:
   он честно скажет, есть картинка или нет. Несуществующие
   просто исчезают из сетки — битых квадратов не будет,
   сколько бы ни лежало лишнего в папке. */
function initThumbs() {
  const box = document.getElementById('thumbs');
  if (!box) return;

  BG = allBackgrounds();
  const today = todayBackdropIndex();

  function paint(current) {
    box.innerHTML = '';
    BG.forEach(function (b, i) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'thumb' + (i === current ? ' on' : '') +
                       (i === today ? ' today' : '');
      cell.title = b.name || '';
      cell.setAttribute('aria-label', b.name || ('Фон ' + (i + 1)));

      const im = document.createElement('img');
      im.src = 'img/' + b.file;
      im.alt = '';
      im.loading = 'lazy';
      /* файла нет — убираем плитку целиком */
      im.onerror = function () { if (cell.parentNode) cell.remove(); };
      cell.appendChild(im);

      if (b.name) {
        const cap = document.createElement('span');
        cap.className = 'thumb-cap';
        cap.textContent = b.name;
        cell.appendChild(cap);
      }

      cell.addEventListener('click', function () { setPic(i); });
      box.appendChild(cell);
    });
  }

  function setPic(i) {
    Store.set('td.pic', i);
    showBackdrop(BG[i]);
    paint(i);
  }

  /* сохранённый выбор мог остаться от прошлого раза, когда
     картин в списке не было — тогда он указывал на другое */
  const cur = currentBackdrop();
  if (Store.get('td.pic', null) !== null) {
    showBackdrop(BG[cur]);
  }
  paint(cur);

  /* Панель выбора фона открывается кнопкой в шапке. */
  const panel = document.getElementById('bgPanel');
  const openBtn = document.getElementById('bgBtn');
  const closeBtn = document.getElementById('bgClose');

  function closePanel() { if (panel) panel.hidden = true; }

  if (openBtn) {
    openBtn.addEventListener('click', function () {
      paint(currentBackdrop());
      if (panel) panel.hidden = false;
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closePanel);

  /* щёлкнули по фону — панель сразу закрывается: выбрал,
     значит всё, показывать её больше незачем */
  box.addEventListener('click', function (e) {
    if (e.target.closest('.thumb')) closePanel();
  });

  /* клик мимо панели тоже закрывает */
  if (panel) {
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closePanel();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePanel();
  });

  const btn = document.getElementById('bgToday');
  if (btn) {
    btn.addEventListener('click', function () {
      const t = todayBackdropIndex();
      Store.set('td.pic', t);
      showBackdrop(BG[t]);
      paint(t);
      closePanel();
    });
  }
}

function initBackdrop() {
  BG = allBackgrounds();
  const i = currentBackdrop();

  /* если сохранённого выбора нет, берём сегодняшний день */
  if (Store.get('td.pic', null) === null) {
    const probe = new Image();
    probe.onload = function () { showBackdrop(BG[i]); };
    probe.onerror = function () { showBackdrop(BG[0]); };
    probe.src = 'img/' + BG[i].file;
  } else {
    showBackdrop(BG[i]);
  }

  initThumbs();
}

/* Заставку снимаем, когда страница готова. Если фотография
   фона не загрузилась — тоже снимаем: лучше одноцветный фон,
   чем заставка, которая висит. */
function hideSplash() {
  const sp = document.getElementById('splash');
  if (!sp) return;
  sp.classList.add('gone');
  /* убираем совсем, чтобы заставка не мешала прокрутке */
  setTimeout(function () {
    if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
  }, 700);
}

/* =============================================================
   ЗАПУСК
   ============================================================= */

function start() {
  initThemes();
  showDate();
  renderNotes();
  initSearch();
  initAsk();
  renderTopicPicker();
  loadWeather();
  loadNews();
  renderToday(0);
  renderFact(0);
  initBackdrop();

  /* Заставку снимаем после отрисовки, а не сразу: если убрать
     её мгновенно, пользователь увидит пустую страницу, пока
     браузер не расставил карточки. */
  requestAnimationFrame(function () { hideSplash(); });
  /* и страховка: если что-то пошло не так, заставка не должна
     висеть вечно */
  setTimeout(hideSplash, 3000);

  document.getElementById('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const text = document.getElementById('addInput').value.trim();
    if (!text) return;
    addNote(document.getElementById('noteTitle').value, text);
    document.getElementById('addInput').value = '';
    document.getElementById('noteTitle').value = '';
    document.getElementById('addInput').style.height = 'auto';
  });

  const ta = document.getElementById('addInput');
  ta.addEventListener('input', function () {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  });

  document.getElementById('btnArchive').addEventListener('click', openArchive);
  document.getElementById('btnExport').addEventListener('click', exportAll);
  document.getElementById('archiveClose').addEventListener('click', closeArchive);
  document.getElementById('newsRefresh').addEventListener('click', function () {
    loadNews();
    this.textContent = 'обновляю…';
    const b = this;
    setTimeout(function () { b.textContent = 'обновить'; }, 900);
  });
  document.getElementById('weatherCityBtn').addEventListener('click', function () {
    loadWeather();
    this.textContent = 'обновляю';
    const b = this;
    setTimeout(function () { b.textContent = 'обновить'; }, 900);
  });
  document.getElementById('todayAnother').addEventListener('click', function () {
    stateOffset.today = (stateOffset.today || 0) + 1;
    renderToday(stateOffset.today);
  });
  document.getElementById('factAnother').addEventListener('click', function () {
    stateOffset.fact = (stateOffset.fact || 0) + 1;
    renderFact(stateOffset.fact);
  });

  /* если сутки сменились, пока вкладка была открыта */
  let lastKey = dayKey();
  /* отдельно следим за временем суток: смена «день → вечер →
     ночь» происходит каждые несколько часов, а сутки могут
     и не смениться. Без этого забытый открытый сайт весь
     день остался бы в утреннем свете. */
  let lastPart = document.documentElement.getAttribute('data-daypart');
  setInterval(function () {
    if (dayKey() !== lastKey) {
      lastKey = dayKey();
      showDate();
      renderNotes();
      paintLimit();
      syncLimit();
      renderToday(0);
      renderFact(0);
    }
    const part = document.documentElement.getAttribute('data-daypart');
    if (part !== lastPart) {
      lastPart = part;
      showDate();
    }
  }, 60000);
}

const stateOffset = { today: 0, fact: 0 };

document.addEventListener('DOMContentLoaded', start);