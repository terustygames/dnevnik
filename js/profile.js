// js/profile.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM элементы
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');
const profileForm = document.getElementById('profileForm');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileRole = document.getElementById('profileRole');
const avatarInitials = document.getElementById('avatarInitials');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const adminNavItem = document.getElementById('adminNavItem');
const roleRequestSection = document.getElementById('roleRequestSection');
const roleRequestStatus = document.getElementById('roleRequestStatus');
const requestTeacherBtn = document.getElementById('requestTeacherBtn');

let originalData = {};
let currentUser = null;
let currentUserData = null;

// Сайдбар
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
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

function generateColorFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#fee140'];
    return colors[Math.abs(hash) % colors.length];
}

function getRoleName(role) {
    const roles = {
        'user': 'Пользователь',
        'teacher': 'Преподаватель',
        'admin': 'Администратор'
    };
    return roles[role] || 'Пользователь';
}

function getRoleClass(role) {
    const classes = {
        'user': 'role-user',
        'teacher': 'role-teacher',
        'admin': 'role-admin'
    };
    return classes[role] || 'role-user';
}

// Загрузка данных профиля
async function loadProfileData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = user;
            currentUserData = userData;

            // Основная информация
            profileName.textContent = userData.fullName || 'Пользователь';
            profileEmail.textContent = user.email;

            // Роль
            const role = userData.role || 'user';
            profileRole.textContent = getRoleName(role);
            profileRole.className = `profile-role ${getRoleClass(role)}`;

            // Аватар
            const initials = getInitials(userData.fullName || 'Пользователь');
            avatarInitials.textContent = initials;
            const color = generateColorFromName(userData.fullName || 'Пользователь');
            avatarPlaceholder.style.background = color;

            // Показываем админ-панель для админов
            if (role === 'admin') {
                adminNavItem.style.display = 'flex';
            }

            // Показываем секцию запроса роли для обычных пользователей
            if (role === 'user') {
                roleRequestSection.style.display = 'block';
                await checkExistingRequest();
            }

            // Заполняем форму
            const formData = {
                fullName: userData.fullName || '',
                phone: userData.phone || '',
                birthDate: userData.birthDate || '',
                address: userData.address || ''
            };

            Object.keys(formData).forEach(key => {
                const input = document.getElementById(key);
                if (input) input.value = formData[key];
            });

            originalData = { ...formData };
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        showToast('Ошибка загрузки профиля', 'error');
    }
}

// Проверка существующей заявки на роль
async function checkExistingRequest() {
    try {
        const q = query(
            collection(db, 'roleRequests'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Заявка уже подана
            roleRequestStatus.innerHTML = `
                <div class="request-pending">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Ваша заявка на рассмотрении</span>
                </div>
            `;
            requestTeacherBtn.style.display = 'none';
        }

        // Проверяем отклоненные заявки
        const rejectedQuery = query(
            collection(db, 'roleRequests'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'rejected')
        );
        const rejectedSnapshot = await getDocs(rejectedQuery);

        if (!rejectedSnapshot.empty) {
            const lastRejected = rejectedSnapshot.docs[0].data();
            roleRequestStatus.innerHTML = `
                <div class="request-rejected">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <span>Предыдущая заявка была отклонена</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Ошибка проверки заявки:', error);
    }
}

// Отправка заявки на роль преподавателя
async function requestTeacherRole() {
    requestTeacherBtn.disabled = true;
    requestTeacherBtn.textContent = 'Отправка...';

    try {
        await addDoc(collection(db, 'roleRequests'), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            userName: currentUserData.fullName || 'Без имени',
            requestedRole: 'teacher',
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        showToast('Заявка успешно отправлена!');

        roleRequestStatus.innerHTML = `
            <div class="request-pending">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Ваша заявка на рассмотрении</span>
            </div>
        `;
        requestTeacherBtn.style.display = 'none';

    } catch (error) {
        console.error('Ошибка отправки заявки:', error);
        showToast('Ошибка отправки заявки', 'error');
        requestTeacherBtn.disabled = false;
        requestTeacherBtn.textContent = 'Подать заявку на роль преподавателя';
    }
}

// Обработчики событий
menuBtn.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
});

// Кнопка запроса роли
requestTeacherBtn.addEventListener('click', requestTeacherRole);

// Сохранение профиля
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
        const formData = {
            fullName: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            birthDate: document.getElementById('birthDate').value,
            address: document.getElementById('address').value,
            updatedAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'users', currentUser.uid), formData);

        originalData = { ...formData };
        profileName.textContent = formData.fullName;
        avatarInitials.textContent = getInitials(formData.fullName);
        avatarPlaceholder.style.background = generateColorFromName(formData.fullName);

        showToast('Данные сохранены');
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showToast('Ошибка сохранения', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить изменения';
    }
});

cancelBtn.addEventListener('click', () => {
    Object.keys(originalData).forEach(key => {
        const input = document.getElementById(key);
        if (input) input.value = originalData[key];
    });
    showToast('Изменения отменены', 'warning');
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
});

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        loadProfileData(user);
    }
});

console.log('Страница профиля загружена');