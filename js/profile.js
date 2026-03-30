import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
const avatarInitials = document.getElementById('avatarInitials');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');

let originalData = {};
let currentUser = null;

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

async function loadProfileData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUser = user;

            profileName.textContent = userData.fullName || 'Пользователь';
            profileEmail.textContent = user.email;

            const initials = getInitials(userData.fullName || 'Пользователь');
            avatarInitials.textContent = initials;

            const color = generateColorFromName(userData.fullName || 'Пользователь');
            avatarPlaceholder.style.background = color;

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

menuBtn.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
});

profileBtn.addEventListener('click', () => {
    window.location.href = 'profile.html';
});

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

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        loadProfileData(user);
    }
});

console.log('Страница профиля загружена');