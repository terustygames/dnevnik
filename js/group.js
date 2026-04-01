import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc, getDoc, setDoc, deleteDoc, collection, getDocs, addDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const groupId = new URLSearchParams(window.location.search).get('id');
if (!groupId) window.location.href = 'groups.html';

// ========== СОСТОЯНИЕ ==========
let currentUser = null;
let currentUserRole = 'user';
let currentGroup = null;

// ========== УТИЛИТЫ ==========
function toast(msg, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

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

// ========== САЙДБАР И НАВИГАЦИЯ ==========
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');

function openSidebar() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

if (menuBtn) {
    menuBtn.addEventListener('click', openSidebar);
}

if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
}

if (overlay) {
    overlay.addEventListener('click', closeSidebar);
}

if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        window.location.href = 'profile.html';
    });
}

// Закрытие по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSidebar();
        // Закрываем все модальные окна
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// ========== ЗАГРУЗКА ГРУППЫ ==========
async function loadGroup() {
    try {
        const snap = await getDoc(doc(db, 'groups', groupId));
        if (!snap.exists()) {
            toast('Группа не найдена', 'error');
            setTimeout(() => window.location.href = 'groups.html', 1500);
            return false;
        }
        currentGroup = { id: snap.id, ...snap.data() };

        const groupTitle = document.getElementById('groupTitle');
        if (groupTitle) {
            groupTitle.textContent = currentGroup.name;
        }
        return true;
    } catch (e) {
        console.error('Ошибка загрузки группы:', e);
        toast('Ошибка загрузки', 'error');
        return false;
    }
}

// ========== УЧАСТНИКИ ==========
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

function renderMembers(members) {
    const modalBody = document.querySelector('#membersModal .modal-body');
    if (!modalBody) return;

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

// ========== ЗАЯВКИ ==========
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

        const badge = document.getElementById('requestsBadge');
        if (badge) {
            if (requestsData.length > 0) {
                badge.textContent = requestsData.length;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
    }
}

function renderRequests(requests) {
    const modalBody = document.querySelector('#requestsModal .modal-body');
    if (!modalBody) return;

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

// Глобальные функции для onclick
window.acceptRequest = async function (requestId, userId) {
    try {
        await setDoc(doc(db, 'groups', groupId, 'members', userId), {
            role: 'member',
            joinedAt: new Date().toISOString(),
            userId: userId
        });

        await deleteDoc(doc(db, 'groups', groupId, 'requests', requestId));

        toast('Заявка принята');
        loadRequests();
        loadMembers();
    } catch (error) {
        console.error('Ошибка принятия заявки:', error);
        toast('Ошибка принятия заявки', 'error');
    }
};

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

// ========== НАСТРОЙКИ ==========
window.copyGroupId = async function () {
    try {
        await navigator.clipboard.writeText(groupId);
        toast('ID группы скопирован');
    } catch (e) {
        const input = document.createElement('input');
        input.value = groupId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast('ID группы скопирован');
    }
};

window.copyGroupCode = async function () {
    const code = currentGroup?.code;
    if (!code) {
        toast('У группы нет кода доступа', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(code);
        toast('Код группы скопирован');
    } catch (e) {
        const input = document.createElement('input');
        input.value = code;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast('Код группы скопирован');
    }
};

window.leaveGroup = async function () {
    if (!confirm('Вы уверены, что хотите покинуть группу?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'groups', groupId, 'members', currentUser.uid));
        toast('Вы покинули группу');
        setTimeout(() => {
            window.location.href = 'groups.html';
        }, 1000);
    } catch (error) {
        console.error('Ошибка при выходе из группы:', error);
        toast('Ошибка при выходе из группы', 'error');
    }
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
};

// ========== СОХРАНЕНИЕ ДАННЫХ В FIREBASE ==========
// Эта функция вызывается из инлайн-скрипта
window.saveTableData = async function (sheetId, cellKey, value) {
    if (currentUserRole === 'user') {
        toast('У вас нет прав для редактирования', 'error');
        return false;
    }

    try {
        const cellRef = doc(db, 'groups', groupId, 'sheets', sheetId, 'cells', cellKey);

        if (value && value.trim()) {
            await setDoc(cellRef, { value: value.trim() });
        } else {
            await deleteDoc(cellRef);
        }
        return true;
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        toast('Ошибка сохранения', 'error');
        return false;
    }
};

// Загрузка данных листа из Firebase
window.loadSheetData = async function (sheetId) {
    try {
        const snap = await getDocs(collection(db, 'groups', groupId, 'sheets', sheetId, 'cells'));
        const data = {};
        snap.docs.forEach(d => {
            data[d.id] = d.data().value;
        });
        return data;
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
        return {};
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ ==========
function initEventListeners() {
    // Кнопка заявок
    const requestsBtn = document.getElementById('requestsBtn');
    if (requestsBtn) {
        requestsBtn.addEventListener('click', async () => {
            if (currentUserRole === 'user') {
                toast('Доступ запрещён', 'error');
                return;
            }
            const modal = document.getElementById('requestsModal');
            if (modal) {
                modal.classList.add('active');
                await loadRequests();
            }
        });
    }

    // Кнопка участников
    const membersBtn = document.getElementById('membersBtn');
    if (membersBtn) {
        membersBtn.addEventListener('click', async () => {
            if (currentUserRole === 'user') {
                toast('Доступ запрещён', 'error');
                return;
            }
            const modal = document.getElementById('membersModal');
            if (modal) {
                modal.classList.add('active');
                await loadMembers();
            }
        });
    }

    // Кнопка настроек
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (!currentGroup) return;

            const groupIdDisplay = document.getElementById('groupIdDisplay');
            const groupCodeDisplay = document.getElementById('groupCodeDisplay');

            if (groupIdDisplay) groupIdDisplay.textContent = groupId;
            if (groupCodeDisplay) groupCodeDisplay.textContent = currentGroup.code || 'Нет кода';

            const modal = document.getElementById('settingsModal');
            if (modal) modal.classList.add('active');
        });
    }

    // Закрытие модальных окон при клике вне
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// ========== ПРОВЕРКА ПРАВ И СКРЫТИЕ ЭЛЕМЕНТОВ ==========
function updateUIForRole() {
    if (currentUserRole === 'user') {
        const requestsBtn = document.getElementById('requestsBtn');
        const membersBtn = document.getElementById('membersBtn');
        const addControls = document.querySelector('.add-controls');

        if (requestsBtn) requestsBtn.style.display = 'none';
        if (membersBtn) membersBtn.style.display = 'none';
        if (addControls) addControls.style.display = 'none';
    }

    // Сохраняем роль глобально для инлайн-скрипта
    window.currentUserRole = currentUserRole;
}

// ========== АВТОРИЗАЦИЯ ==========
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    window.currentUserId = user.uid;

    // Получаем роль пользователя
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role || 'user';
        }
    } catch (error) {
        console.error('Ошибка получения роли:', error);
    }

    // Загружаем группу
    const ok = await loadGroup();
    if (!ok) return;

    // Обновляем UI в зависимости от роли
    updateUIForRole();

    // Инициализируем обработчики
    initEventListeners();

    // Загружаем заявки и участников только для преподавателей
    if (currentUserRole === 'teacher' || currentUserRole === 'admin') {
        await loadRequests();
    }

    // Сообщаем инлайн-скрипту что Firebase готов
    window.firebaseReady = true;
    document.dispatchEvent(new Event('firebaseReady'));
});

console.log('Group.js загружен');