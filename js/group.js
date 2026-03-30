import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const groupId = new URLSearchParams(window.location.search).get('id');
if (!groupId) window.location.href = 'groups.html';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let currentGroup = null;
let tabs = [];
let currentTab = null;
let tableData = {};

// Размер таблицы
const ROWS = 50;
const COLS = 26;

// ========== УТИЛИТЫ ==========
function $(id) {
    return document.getElementById(id);
}

function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 2500);
}

function colName(index) {
    return String.fromCharCode(65 + index);
}

// ========== САЙДБАР ==========
$('menuBtn').onclick = () => {
    $('sidebar').classList.add('active');
    $('overlay').classList.add('active');
};

$('closeBtn').onclick = closeSidebar;
$('overlay').onclick = closeSidebar;

function closeSidebar() {
    $('sidebar').classList.remove('active');
    $('overlay').classList.remove('active');
}

// ========== ЗАГРУЗКА ДАННЫХ ==========
async function loadGroup() {
    try {
        const snap = await getDoc(doc(db, 'groups', groupId));
        if (!snap.exists()) {
            toast('Группа не найдена', 'error');
            setTimeout(() => window.location.href = 'groups.html', 1500);
            return false;
        }
        currentGroup = { id: snap.id, ...snap.data() };
        $('groupTitle').textContent = currentGroup.name;
        return true;
    } catch (e) {
        console.error('Ошибка загрузки группы:', e);
        toast('Ошибка загрузки', 'error');
        return false;
    }
}

async function loadTabs() {
    try {
        const snap = await getDocs(collection(db, 'groups', groupId, 'sheets'));
        tabs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Если нет вкладок, создаём первую
        if (tabs.length === 0) {
            await createTab('Основная');
            return;
        }

        renderTabs();
        await switchTab(tabs[0].id);
    } catch (e) {
        console.error('Ошибка загрузки вкладок:', e);
        toast('Ошибка загрузки', 'error');
    }
}

async function loadTableData(tabId) {
    try {
        const snap = await getDocs(collection(db, 'groups', groupId, 'sheets', tabId, 'cells'));
        tableData = {};
        snap.docs.forEach(d => {
            tableData[d.id] = d.data().value;
        });
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
    }
}

// ========== РЕНДЕР ==========
function renderTabs() {
    $('tabsList').innerHTML = tabs.map(tab => `
        <button class="tab ${tab.id === currentTab ? 'active' : ''}" data-id="${tab.id}">
            <span>${tab.name}</span>
            ${tabs.length > 1 ? `<span class="tab-close" data-id="${tab.id}">✕</span>` : ''}
        </button>
    `).join('');

    // Обработчики
    document.querySelectorAll('.tab').forEach(el => {
        el.onclick = (e) => {
            if (e.target.classList.contains('tab-close')) {
                deleteTab(e.target.dataset.id);
            } else {
                switchTab(el.dataset.id);
            }
        };
    });
}

function renderTable() {
    let html = '<thead><tr><th class="corner"></th>';

    // Заголовки столбцов (A, B, C...)
    for (let c = 0; c < COLS; c++) {
        html += `<th>${colName(c)}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Строки
    for (let r = 0; r < ROWS; r++) {
        html += `<tr data-row="${r}">`;
        html += `<th class="row-num">${r + 1}</th>`;

        for (let c = 0; c < COLS; c++) {
            const key = `${r}_${c}`;
            const value = tableData[key] || '';
            html += `<td data-row="${r}" data-col="${c}">
                <input type="text" value="${escapeHtml(value)}" data-key="${key}">
            </td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';

    $('excel').innerHTML = html;
    attachCellHandlers();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function attachCellHandlers() {
    document.querySelectorAll('.excel input').forEach(input => {
        // При фокусе подсвечиваем строку
        input.onfocus = () => {
            document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('tr.selected').forEach(el => el.classList.remove('selected'));

            const td = input.closest('td');
            const tr = input.closest('tr');
            td.classList.add('selected');
            tr.classList.add('selected');
        };

        // При изменении сохраняем
        input.onchange = () => {
            const key = input.dataset.key;
            const value = input.value;
            saveCell(key, value);
        };

        // Навигация
        input.onkeydown = (e) => {
            const td = input.closest('td');
            const row = parseInt(td.dataset.row);
            const col = parseInt(td.dataset.col);

            if (e.key === 'Enter') {
                e.preventDefault();
                moveTo(row + 1, col);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    moveTo(row, col - 1);
                } else {
                    moveTo(row, col + 1);
                }
            } else if (e.key === 'ArrowUp' && !input.value) {
                e.preventDefault();
                moveTo(row - 1, col);
            } else if (e.key === 'ArrowDown' && !input.value) {
                e.preventDefault();
                moveTo(row + 1, col);
            } else if (e.key === 'ArrowLeft' && input.selectionStart === 0) {
                e.preventDefault();
                moveTo(row, col - 1);
            } else if (e.key === 'ArrowRight' && input.selectionStart === input.value.length) {
                e.preventDefault();
                moveTo(row, col + 1);
            }
        };
    });
}

function moveTo(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    const input = document.querySelector(`td[data-row="${row}"][data-col="${col}"] input`);
    if (input) input.focus();
}

// ========== СОХРАНЕНИЕ ==========
async function saveCell(key, value) {
    try {
        const cellRef = doc(db, 'groups', groupId, 'sheets', currentTab, 'cells', key);

        if (value.trim()) {
            await setDoc(cellRef, { value: value.trim() });
            tableData[key] = value.trim();
        } else {
            await deleteDoc(cellRef);
            delete tableData[key];
        }
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        toast('Ошибка сохранения', 'error');
    }
}

$('saveBtn').onclick = () => {
    toast('Данные сохраняются автоматически');
};

// ========== ВКЛАДКИ ==========
async function switchTab(tabId) {
    currentTab = tabId;
    renderTabs();
    await loadTableData(tabId);
    renderTable();
}

async function createTab(name) {
    try {
        const docRef = await addDoc(collection(db, 'groups', groupId, 'sheets'), {
            name,
            createdAt: new Date().toISOString()
        });

        tabs.push({ id: docRef.id, name });
        renderTabs();
        await switchTab(docRef.id);
        toast('Лист создан');
    } catch (e) {
        console.error('Ошибка создания:', e);
        toast('Ошибка создания', 'error');
    }
}

async function deleteTab(tabId) {
    if (tabs.length <= 1) {
        toast('Нельзя удалить единственный лист', 'error');
        return;
    }

    if (!confirm('Удалить этот лист? Все данные будут потеряны.')) return;

    try {
        // Удаляем все ячейки
        const cellsSnap = await getDocs(collection(db, 'groups', groupId, 'sheets', tabId, 'cells'));
        for (const cell of cellsSnap.docs) {
            await deleteDoc(cell.ref);
        }

        // Удаляем сам лист
        await deleteDoc(doc(db, 'groups', groupId, 'sheets', tabId));

        tabs = tabs.filter(t => t.id !== tabId);
        renderTabs();

        if (currentTab === tabId) {
            await switchTab(tabs[0].id);
        }

        toast('Лист удалён');
    } catch (e) {
        console.error('Ошибка удаления:', e);
        toast('Ошибка удаления', 'error');
    }
}

// Модалка
$('addTabBtn').onclick = () => {
    $('tabNameInput').value = '';
    $('modal').classList.add('active');
    $('tabNameInput').focus();
};

$('cancelBtn').onclick = () => {
    $('modal').classList.remove('active');
};

$('confirmBtn').onclick = () => {
    const name = $('tabNameInput').value.trim();
    if (!name) {
        toast('Введите название', 'error');
        return;
    }
    $('modal').classList.remove('active');
    createTab(name);
};

$('tabNameInput').onkeydown = (e) => {
    if (e.key === 'Enter') {
        $('confirmBtn').click();
    } else if (e.key === 'Escape') {
        $('cancelBtn').click();
    }
};

// ========== ЭКСПОРТ ==========
$('exportBtn').onclick = () => {
    let csv = '';

    // Заголовки
    csv += ',' + Array.from({ length: COLS }, (_, i) => colName(i)).join(',') + '\n';

    // Данные
    for (let r = 0; r < ROWS; r++) {
        const row = [r + 1];
        for (let c = 0; c < COLS; c++) {
            const value = tableData[`${r}_${c}`] || '';
            row.push(`"${value.replace(/"/g, '""')}"`);
        }
        csv += row.join(',') + '\n';
    }

    // Скачиваем
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentGroup.name}_${tabs.find(t => t.id === currentTab)?.name || 'data'}.csv`;
    link.click();

    toast('Файл скачан');
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;

    const ok = await loadGroup();
    if (!ok) return;

    await loadTabs();
});

console.log('Excel редактор загружен');