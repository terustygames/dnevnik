import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Элементы DOM
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');
const notificationBtn = document.getElementById('notificationBtn');
const groupsList = document.getElementById('groupsList');

// Модальные окна
const createModal = document.getElementById('createModal');
const joinModal = document.getElementById('joinModal');
const createGroupBtn = document.getElementById('createGroupBtn');
const joinGroupBtn = document.getElementById('joinGroupBtn');
const closeCreateModal = document.getElementById('closeCreateModal');
const closeJoinModal = document.getElementById('closeJoinModal');
const cancelCreate = document.getElementById('cancelCreate');
const cancelJoin = document.getElementById('cancelJoin');
const createGroupForm = document.getElementById('createGroupForm');
const joinGroupForm = document.getElementById('joinGroupForm');
const groupCodeInput = document.getElementById('groupCode');
const joinError = document.getElementById('joinError');

let currentUser = null;
let currentUserRole = 'user';

// Функции сайдбара
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

// Toast уведомления
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Генерация кода группы
function generateGroupCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Получение инициалов
function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

// Модальные окна
function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Загрузка групп пользователя
async function loadUserGroups() {
    groupsList.innerHTML = '<p style="text-align: center; padding: 20px;">Загрузка...</p>';

    try {
        const userGroups = [];

        // Получаем все группы
        const groupsSnapshot = await getDocs(collection(db, 'groups'));

        for (const groupDoc of groupsSnapshot.docs) {
            const groupData = groupDoc.data();

            // Проверяем, является ли пользователь участником
            const memberDoc = await getDoc(doc(db, 'groups', groupDoc.id, 'members', currentUser.uid));

            if (memberDoc.exists()) {
                userGroups.push({
                    id: groupDoc.id,
                    ...groupData,
                    memberData: memberDoc.data()
                });
            }
        }

        renderGroups(userGroups);
    } catch (error) {
        console.error('Ошибка загрузки групп:', error);
        groupsList.innerHTML = '<p style="text-align: center; color: #e74c3c;">Ошибка загрузки групп</p>';
    }
}

// Отрисовка групп
function renderGroups(groups) {
    if (groups.length === 0) {
        groupsList.innerHTML = `
            <div class="groups-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3>У вас пока нет групп</h3>
                <p>Создайте новую группу или войдите в существующую по коду</p>
            </div>
        `;
        return;
    }

    groupsList.innerHTML = groups.map(group => `
        <div class="group-card" data-id="${group.id}">
            <div class="group-card-header">
                <div class="group-avatar">${getInitials(group.name)}</div>
                <div class="group-card-info">
                    <h3>${group.name}</h3>
                    <p>${group.description || 'Без описания'}</p>
                </div>
            </div>
            <div class="group-card-stats">
                <div class="stat-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    <span>${group.memberCount || 1} участников</span>
                </div>
                <div class="stat-item">
                    <span class="member-role ${group.memberData.role === 'admin' ? 'role-admin' : 'role-member'}">
                        ${group.memberData.role === 'admin' ? 'Админ' : 'Участник'}
                    </span>
                </div>
            </div>
            <button class="group-leave-btn" data-id="${group.id}" title="Выйти из группы">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </button>
        </div>
    `).join('');

    // Обработчики клика на карточки
    document.querySelectorAll('.group-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Игнорируем клик на кнопке выхода
            if (e.target.closest('.group-leave-btn')) {
                return;
            }
            const groupId = card.dataset.id;
            window.location.href = `group.html?id=${groupId}`;
        });
    });

    // Обработчики кнопок выхода
    document.querySelectorAll('.group-leave-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const groupId = btn.dataset.id;
            await leaveGroupFromList(groupId);
        });
    });
}

// Функция выхода из группы со списка
async function leaveGroupFromList(groupId) {
    if (!confirm('Вы уверены, что хотите покинуть группу?')) {
        return;
    }

    try {
        // Удаляем пользователя из members
        await deleteDoc(doc(db, 'groups', groupId, 'members', currentUser.uid));

        showToast('Вы покинули группу');

        // Перезагружаем список групп
        loadUserGroups();

    } catch (error) {
        console.error('Ошибка при выходе из группы:', error);
        showToast('Ошибка при выходе из группы', 'error');
    }
}

// Создание группы
async function createGroup(e) {
    e.preventDefault();

    // Проверка роли
    if (currentUserRole === 'user') {
        showToast('Только преподаватели могут создавать группы', 'error');
        return;
    }

    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDescription').value.trim();
    const code = groupCodeInput.value;

    try {
        // Создаем группу
        const groupRef = await addDoc(collection(db, 'groups'), {
            name: name,
            description: description,
            code: code,
            createdBy: currentUser.uid,
            createdAt: new Date().toISOString(),
            memberCount: 1
        });

        // Добавляем создателя как админа
        await setDoc(doc(db, 'groups', groupRef.id, 'members', currentUser.uid), {
            role: 'admin',
            joinedAt: new Date().toISOString(),
            userId: currentUser.uid
        });

        closeModal(createModal);
        createGroupForm.reset();
        showToast('Группа успешно создана!');
        loadUserGroups();

    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showToast('Ошибка создания группы', 'error');
    }
}

// Вход в группу по коду
async function joinGroup(e) {
    e.preventDefault();

    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    joinError.textContent = '';

    try {
        // Ищем группу по коду
        const groupsRef = collection(db, 'groups');
        const q = query(groupsRef, where('code', '==', code));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            joinError.textContent = 'Группа с таким кодом не найдена';
            return;
        }

        const groupDoc = querySnapshot.docs[0];
        const groupId = groupDoc.id;

        // Проверяем, не состоит ли уже в группе
        const memberDoc = await getDoc(doc(db, 'groups', groupId, 'members', currentUser.uid));

        if (memberDoc.exists()) {
            joinError.textContent = 'Вы уже состоите в этой группе';
            return;
        }

        // Добавляем пользователя в группу
        await setDoc(doc(db, 'groups', groupId, 'members', currentUser.uid), {
            role: 'member',
            joinedAt: new Date().toISOString(),
            userId: currentUser.uid
        });

        closeModal(joinModal);
        joinGroupForm.reset();
        showToast('Вы успешно вошли в группу!');
        loadUserGroups();

    } catch (error) {
        console.error('Ошибка входа в группу:', error);
        showToast('Ошибка входа в группу', 'error');
    }
}

// Обработчики событий
menuBtn.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSidebar();
        closeModal(createModal);
        closeModal(joinModal);
    }
});

profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
});

notificationBtn.addEventListener('click', () => {
    showToast('Уведомлений пока нет', 'warning');
});

// Модальные окна
createGroupBtn.addEventListener('click', () => {
    groupCodeInput.value = generateGroupCode();
    openModal(createModal);
});

joinGroupBtn.addEventListener('click', () => {
    openModal(joinModal);
});

closeCreateModal.addEventListener('click', () => closeModal(createModal));
closeJoinModal.addEventListener('click', () => closeModal(joinModal));
cancelCreate.addEventListener('click', () => closeModal(createModal));
cancelJoin.addEventListener('click', () => closeModal(joinModal));

createGroupForm.addEventListener('submit', createGroup);
joinGroupForm.addEventListener('submit', joinGroup);

// Закрытие модальных окон при клике вне
createModal.addEventListener('click', (e) => {
    if (e.target === createModal) closeModal(createModal);
});

joinModal.addEventListener('click', (e) => {
    if (e.target === joinModal) closeModal(joinModal);
});

// Проверка авторизации
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser = user;

        // Получаем роль пользователя
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role || 'user';
        }

        // Скрываем кнопку создания группы для обычных пользователей
        if (currentUserRole === 'user') {
            createGroupBtn.style.display = 'none';
        }

        loadUserGroups();
    }
});

console.log('Страница групп загружена');