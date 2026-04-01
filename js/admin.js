import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM элементы
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');

// Статистика
const totalUsers = document.getElementById('totalUsers');
const totalTeachers = document.getElementById('totalTeachers');
const totalGroups = document.getElementById('totalGroups');

// Контент
const usersList = document.getElementById('usersList');
const userSearch = document.getElementById('userSearch');

let allUsers = [];

// Сайдбар
function openSidebar() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
}

function closeSidebarFunc() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
}

menuBtn.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebarFunc);
overlay.addEventListener('click', closeSidebarFunc);

profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
});

// Toast
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    let bgColor = '#27ae60';
    if (type === 'error') bgColor = '#e74c3c';
    if (type === 'warning') bgColor = '#f39c12';

    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Утилиты
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

// Загрузка статистики
async function loadStats() {
    try {
        // Пользователи
        const usersSnap = await getDocs(collection(db, 'users'));
        allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        totalUsers.textContent = allUsers.length;
        totalTeachers.textContent = allUsers.filter(u => u.role === 'teacher').length;

        // Группы
        const groupsSnap = await getDocs(collection(db, 'groups'));
        totalGroups.textContent = groupsSnap.size;

    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка пользователей
async function loadUsers() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        renderUsers(allUsers);

    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        usersList.innerHTML = `
            <div class="empty-state">
                <p>Ошибка загрузки пользователей</p>
            </div>
        `;
    }
}

// Отрисовка пользователей
function renderUsers(users) {
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <p>Пользователи не найдены</p>
            </div>
        `;
        return;
    }

    usersList.innerHTML = users.map(user => {
        const role = user.role || 'user';
        const roleClass = `role-${role}`;
        const roleName = {
            'user': 'Пользователь',
            'teacher': 'Преподаватель',
            'admin': 'Администратор'
        }[role] || 'Пользователь';

        return `
            <div class="user-item" data-id="${user.id}">
                <div class="user-info">
                    <div class="user-avatar">${getInitials(user.fullName)}</div>
                    <div class="user-details">
                        <strong>${user.fullName || 'Без имени'}</strong>
                        <span>${user.email}</span>
                    </div>
                </div>
                <div class="user-actions">
                    <span class="user-role ${roleClass}">${roleName}</span>
                    <select class="role-select" onchange="changeUserRole('${user.id}', this.value)">
                        <option value="user" ${role === 'user' ? 'selected' : ''}>Пользователь</option>
                        <option value="teacher" ${role === 'teacher' ? 'selected' : ''}>Преподаватель</option>
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
            </div>
        `;
    }).join('');
}

// Изменить роль пользователя
window.changeUserRole = async function (userId, newRole) {
    if (!confirm(`Изменить роль пользователя на "${newRole}"?`)) {
        loadUsers();
        return;
    }

    try {
        await updateDoc(doc(db, 'users', userId), {
            role: newRole,
            roleUpdatedAt: new Date().toISOString(),
            roleUpdatedBy: auth.currentUser.uid
        });

        showToast('Роль успешно изменена');
        loadUsers();
        loadStats();

    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        showToast('Ошибка при изменении роли', 'error');
        loadUsers();
    }
};

// Поиск пользователей
userSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (!searchTerm) {
        renderUsers(allUsers);
        return;
    }

    const filtered = allUsers.filter(user =>
        (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm))
    );

    renderUsers(filtered);
});

// Проверка авторизации и прав
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            showToast('Доступ запрещен. Только для администраторов.', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return;
        }

        // Загружаем данные
        await loadStats();
        await loadUsers();

    } catch (error) {
        console.error('Ошибка проверки прав:', error);
        window.location.href = 'index.html';
    }
});

console.log('Админ-панель загружена');