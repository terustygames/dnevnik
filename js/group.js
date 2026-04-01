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
let currentUserRole = 'user';
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
if ($('menuBtn')) {
    $('menuBtn').onclick = () => {
        $('sidebar').classList.add('active');
        $('overlay').classList.add('active');
    };
}

if ($('closeBtn')) {
    $('closeBtn').onclick = closeSidebar;
}

if ($('overlay')) {
    $('overlay').onclick = closeSidebar;
}

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
    if (!$('tabsList')) return;

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
    if (!$('excel')) return;

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
        // Делаем поля только для чтения для обычных пользователей
        if (currentUserRole === 'user') {
            input.readOnly = true;
            input.style.cursor = 'not-allowed';
            input.style.backgroundColor = '#f5f5f5';
        }

        // При фокусе подсвечиваем строку
        input.onfocus = () => {
            document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('tr.selected').forEach(el => el.classList.remove('selected'));

            const td = input.closest('td');
            const tr = input.closest('tr');
            td.classList.add('selected');
            tr.classList.add('selected');
        };

        // При изменении сохраняем (только для преподавателей)
        input.onchange = () => {
            if (currentUserRole === 'user') {
                toast('У вас нет прав для редактирования', 'error');
                return;
            }
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
    // Проверка роли
    if (currentUserRole === 'user') {
        toast('У вас нет прав для редактирования', 'error');
        return;
    }

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

if ($('saveBtn')) {
    $('saveBtn').onclick = () => {
        toast('Данные сохраняются автоматически');
    };
}

// ========== ВКЛАДКИ ==========
async function switchTab(tabId) {
    currentTab = tabId;
    renderTabs();
    await loadTableData(tabId);
    renderTable();
}

async function createTab(name) {
    // Проверка роли
    if (currentUserRole === 'user') {
        toast('У вас нет прав для создания листов', 'error');
        return;
    }

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
    // Проверка роли
    if (currentUserRole === 'user') {
        toast('У вас нет прав для удаления листов', 'error');
        return;
    }

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

// Модалка для добавления вкладки
if ($('addTabBtn')) {
    $('addTabBtn').onclick = () => {
        if (currentUserRole === 'user') {
            toast('У вас нет прав для создания листов', 'error');
            return;
        }
        $('tabNameInput').value = '';
        $('modal').classList.add('active');
        $('tabNameInput').focus();
    };
}

if ($('cancelBtn')) {
    $('cancelBtn').onclick = () => {
        $('modal').classList.remove('active');
    };
}

if ($('confirmBtn')) {
    $('confirmBtn').onclick = () => {
        const name = $('tabNameInput').value.trim();
        if (!name) {
            toast('Введите название', 'error');
            return;
        }
        $('modal').classList.remove('active');
        createTab(name);
    };
}

if ($('tabNameInput')) {
    $('tabNameInput').onkeydown = (e) => {
        if (e.key === 'Enter') {
            $('confirmBtn').click();
        } else if (e.key === 'Escape') {
            $('cancelBtn').click();
        }
    };
}

// ========== ЭКСПОРТ ==========
if ($('exportBtn')) {
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
}

// ========== УЧАСТНИКИ И ЗАЯВКИ ==========

// Загрузка участников группы
async function loadMembers() {
    try {
        const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
        const membersData = [];

        for (const memberDoc of membersSnap.docs) {
            const memberData = memberDoc.data();
            const userDoc = await getDoc(doc(db, 'users', memberData.userId));

            if (userDoc.exists()) {
                membersData.push({
                    id: memberDoc.id,
                    ...memberData,
                    userInfo: userDoc.data()
                });
            }
        }

        renderMembers(membersData);
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
    }
}

// Отрисовка участников
function renderMembers(members) {
    const modalBody = document.querySelector('#membersModal .modal-body');

    if (members.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-state">
                <p>Список участников пуст</p>
            </div>
        `;
        return;
    }

    modalBody.innerHTML = members.map(member => {
        const initials = member.userInfo.fullName
            ? member.userInfo.fullName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
            : '?';

        const roleText = member.role === 'admin' ? 'Админ' : 'Участник';
        const roleClass = member.role === 'admin' ? 'role-admin' : 'role-member';

        return `
            <div class="member-item">
                <div class="member-info">
                    <div class="member-avatar">${initials}</div>
                    <div>
                        <strong>${member.userInfo.fullName || 'Без имени'}</strong><br>
                        <span style="color: #666; font-size: 0.9rem;">${member.userInfo.email}</span>
                    </div>
                </div>
                <span class="member-role ${roleClass}">${roleText}</span>
            </div>
        `;
    }).join('');
}

// Загрузка заявок на вступление
async function loadRequests() {
    try {
        const requestsSnap = await getDocs(collection(db, 'groups', groupId, 'requests'));
        const requestsData = [];

        for (const requestDoc of requestsSnap.docs) {
            const requestData = requestDoc.data();
            if (requestData.status === 'pending') {
                const userDoc = await getDoc(doc(db, 'users', requestData.userId));

                if (userDoc.exists()) {
                    requestsData.push({
                        id: requestDoc.id,
                        ...requestData,
                        userInfo: userDoc.data()
                    });
                }
            }
        }

        renderRequests(requestsData);

        // Обновляем бейдж
        const badge = document.getElementById('requestsBadge');
        if (requestsData.length > 0) {
            badge.textContent = requestsData.length;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

// Отрисовка заявок
function renderRequests(requests) {
    const modalBody = document.querySelector('#requestsModal .modal-body');

    if (requests.length === 0) {
        modalBody.innerHTML = `
            <div class="empty-state">
                <p>Нет новых заявок</p>
            </div>
        `;
        return;
    }

    modalBody.innerHTML = requests.map(request => {
        const initials = request.userInfo.fullName
            ? request.userInfo.fullName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2)
            : '?';

        return `
            <div class="request-item">
                <div class="request-info">
                    <div class="member-avatar">${initials}</div>
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${request.userInfo.fullName || 'Без имени'}</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">${request.userInfo.email}</p>
                    </div>
                </div>
                <div class="request-actions">
                    <button class="btn-accept" onclick="acceptRequest('${request.id}', '${request.userId}')">Принять</button>
                    <button class="btn-reject" onclick="rejectRequest('${request.id}')">Отклонить</button>
                </div>
            </div>
        `;
    }).join('');
}

// Принять заявку
window.acceptRequest = async function (requestId, userId) {
    try {
        // Добавляем пользователя в участники
        await setDoc(doc(db, 'groups', groupId, 'members', userId), {
            role: 'member',
            joinedAt: new Date().toISOString(),
            userId: userId
        });

        // Удаляем заявку
        await deleteDoc(doc(db, 'groups', groupId, 'requests', requestId));

        toast('Заявка принята');
        loadRequests();
        loadMembers();
    } catch (error) {
        console.error('Ошибка принятия заявки:', error);
        toast('Ошибка принятия заявки', 'error');
    }
};

// Отклонить заявку
window.rejectRequest = async function (requestId) {
    try {
        await deleteDoc(doc(db, 'groups', groupId, 'requests', requestId));
        toast('Заявка отклонена');
        loadRequests();
    } catch (error) {
        console.error('Ошибка отклонения заявки:', error);
        toast('Ошибка отклонения заявки', 'error');
    }
};

// Обработчики модальных окон
if (document.getElementById('requestsBtn')) {
    document.getElementById('requestsBtn').onclick = async () => {
        // Проверка роли
        if (currentUserRole === 'user') {
            toast('Доступ запрещён', 'error');
            return;
        }
        document.getElementById('requestsModal').classList.add('active');
        await loadRequests();
    };
}

if (document.getElementById('membersBtn')) {
    document.getElementById('membersBtn').onclick = async () => {
        // Проверка роли
        if (currentUserRole === 'user') {
            toast('Доступ запрещён', 'error');
            return;
        }
        document.getElementById('membersModal').classList.add('active');
        await loadMembers();
    };
}

// ========== НАСТРОЙКИ ГРУППЫ ==========

// Открытие модального окна настроек
if ($('settingsBtn')) {
    $('settingsBtn').onclick = () => {
        if (!currentGroup) return;

        // Заполняем данные
        $('groupIdDisplay').textContent = groupId;
        $('groupCodeDisplay').textContent = currentGroup.code || 'Нет кода';

        $('settingsModal').classList.add('active');
    };
}

// Копирование ID группы
window.copyGroupId = async function () {
    try {
        await navigator.clipboard.writeText(groupId);
        toast('ID группы скопирован');
    } catch (e) {
        // Fallback для старых браузеров
        const input = document.createElement('input');
        input.value = groupId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast('ID группы скопирован');
    }
};

// Копирование кода группы
window.copyGroupCode = async function () {
    const code = currentGroup.code;
    if (!code) {
        toast('У группы нет кода доступа', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(code);
        toast('Код группы скопирован');
    } catch (e) {
        // Fallback
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast('Код группы скопирован');
    }
};

// Выход из группы
window.leaveGroup = async function () {
    if (!confirm('Вы уверены, что хотите покинуть группу? Все ваши данные будут удалены.')) {
        return;
    }

    try {
        // Удаляем пользователя из members
        await deleteDoc(doc(db, 'groups', groupId, 'members', currentUser.uid));

        toast('Вы покинули группу');

        // Перенаправляем на страницу групп
        setTimeout(() => {
            window.location.href = 'groups.html';
        }, 1000);

    } catch (error) {
        console.error('Ошибка при выходе из группы:', error);
        toast('Ошибка при выходе из группы', 'error');
    }
};

// Закрытие модальных окон
window.closeModal = function (modalId) {
    document.getElementById(modalId).classList.remove('active');
};

// Закрытие модальных окон при клике вне
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;

    // Получаем роль пользователя
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role || 'user';
            // Сохраняем роль в localStorage
            localStorage.setItem('userRole', currentUserRole);
        }
    } catch (error) {
        console.error('Ошибка получения роли:', error);
    }

    // Скрываем кнопки для обычных пользователей
    if (currentUserRole === 'user') {
        // Скрываем кнопки "Заявки" и "Участники"
        const requestsBtn = document.getElementById('requestsBtn');
        const membersBtn = document.getElementById('membersBtn');

        if (requestsBtn) requestsBtn.style.display = 'none';
        if (membersBtn) membersBtn.style.display = 'none';

        // Скрываем кнопки добавления
        const addControls = document.querySelector('.add-controls');
        if (addControls) addControls.style.display = 'none';
    }

    const ok = await loadGroup();
    if (!ok) return;

    await loadTabs();

    // Загружаем заявки и участников только для преподавателей
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
        await loadRequests();
        await loadMembers();
    }
});

console.log('Excel редактор загружен');