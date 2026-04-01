import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const storage = getStorage();

let currentUser = null;
let currentUserRole = 'user';
let selectedImage = null;
let currentZoom = 1;

const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');
const uploadBtn = document.getElementById('uploadBtn');
const replacementDate = document.getElementById('replacementDate');
const replacementsList = document.getElementById('replacementsList');

const uploadModal = document.getElementById('uploadModal');
const closeUploadModal = document.getElementById('closeUploadModal');
const uploadDropzone = document.getElementById('uploadDropzone');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImage = document.getElementById('removeImage');
const uploadDateInput = document.getElementById('uploadDate');
const uploadDescription = document.getElementById('uploadDescription');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const cancelUpload = document.getElementById('cancelUpload');
const confirmUpload = document.getElementById('confirmUpload');

const imageViewer = document.getElementById('imageViewer');
const closeViewer = document.getElementById('closeViewer');
const viewerImage = document.getElementById('viewerImage');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const downloadImage = document.getElementById('downloadImage');
const adminNavItem = document.getElementById('adminNavItem');

function toast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    document.body.appendChild(t);

    requestAnimationFrame(() => {
        t.classList.add('show');
    });

    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('ru-RU', options);
}

function formatDateShort(dateString) {
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('ru-RU', options);
}

function getCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('ru-RU', options);
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

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

if (menuBtn) menuBtn.addEventListener('click', openSidebar);
if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
if (overlay) overlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSidebar();
        closeModal();
        closeImageViewer();
    }
});

if (profileBtn) {
    profileBtn.addEventListener('click', () => {
        window.location.href = 'profile.html';
    });
}

async function loadReplacements(date) {
    replacementsList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Загрузка...</p>
        </div>
    `;

    try {
        const replacementsRef = collection(db, 'replacements');
        const q = query(
            replacementsRef,
            where('date', '==', date),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            replacementsList.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <h3>Нет замен на ${formatDateShort(date)}</h3>
                    <p>Замены на эту дату не опубликованы</p>
                </div>
            `;
            return;
        }

        replacementsList.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const isAdmin = currentUserRole === 'admin';

            return `
                <div class="replacement-card" data-id="${doc.id}">
                    <div class="replacement-card-header">
                        <div class="replacement-date-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span>${formatDate(data.date)}</span>
                        </div>
                        ${isAdmin ? `
                            <div class="replacement-actions">
                                <button class="btn-icon delete" onclick="deleteReplacement('${doc.id}', '${data.imagePath}')" title="Удалить">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="replacement-image-container" onclick="openImageViewer('${data.imageUrl}')">
                        <img src="${data.imageUrl}" alt="Замены" class="replacement-image" loading="lazy">
                        <div class="image-overlay">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                            </svg>
                        </div>
                    </div>
                    ${data.description ? `
                        <div class="replacement-description">${data.description}</div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ошибка загрузки замен:', error);
        replacementsList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Ошибка загрузки</h3>
                <p>Попробуйте обновить страницу</p>
            </div>
        `;
    }
}

function openModal() {
    uploadModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    uploadDateInput.value = replacementDate.value || getTodayISO();
}

function closeModal() {
    uploadModal.classList.remove('active');
    document.body.style.overflow = '';
    resetUploadForm();
}

function resetUploadForm() {
    selectedImage = null;
    imageInput.value = '';
    uploadDateInput.value = getTodayISO();
    uploadDescription.value = '';
    imagePreview.style.display = 'none';
    uploadDropzone.style.display = 'block';
    uploadProgress.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    confirmUpload.disabled = true;
}

if (uploadBtn) {
    uploadBtn.addEventListener('click', openModal);
}

if (closeUploadModal) {
    closeUploadModal.addEventListener('click', closeModal);
}

if (cancelUpload) {
    cancelUpload.addEventListener('click', closeModal);
}

uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) closeModal();
});

uploadDropzone.addEventListener('click', () => {
    imageInput.click();
});

uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
});

uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
});

uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageSelect(file);
    } else {
        toast('Выберите изображение', 'error');
    }
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageSelect(file);
    }
});

function handleImageSelect(file) {
    if (file.size > 5 * 1024 * 1024) {
        toast('Файл слишком большой (макс. 5MB)', 'error');
        return;
    }

    selectedImage = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
        uploadDropzone.style.display = 'none';
        confirmUpload.disabled = false;
    };
    reader.readAsDataURL(file);
}

removeImage.addEventListener('click', () => {
    selectedImage = null;
    imageInput.value = '';
    imagePreview.style.display = 'none';
    uploadDropzone.style.display = 'block';
    confirmUpload.disabled = true;
});

confirmUpload.addEventListener('click', async () => {
    if (!selectedImage || !uploadDateInput.value) {
        toast('Заполните все поля', 'error');
        return;
    }

    confirmUpload.disabled = true;
    cancelUpload.disabled = true;
    uploadProgress.style.display = 'flex';

    try {
        const timestamp = Date.now();
        const fileName = `replacements/${uploadDateInput.value}_${timestamp}_${selectedImage.name}`;
        const storageRef = ref(storage, fileName);

        const uploadTask = uploadBytesResumable(storageRef, selectedImage);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressFill.style.width = progress + '%';
                progressText.textContent = Math.round(progress) + '%';
            },
            (error) => {
                console.error('Ошибка загрузки:', error);
                toast('Ошибка загрузки файла', 'error');
                confirmUpload.disabled = false;
                cancelUpload.disabled = false;
                uploadProgress.style.display = 'none';
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                await addDoc(collection(db, 'replacements'), {
                    date: uploadDateInput.value,
                    imageUrl: downloadURL,
                    imagePath: fileName,
                    description: uploadDescription.value.trim(),
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser.uid
                });

                toast('Замены успешно загружены');
                closeModal();

                if (replacementDate.value === uploadDateInput.value) {
                    loadReplacements(replacementDate.value);
                }
            }
        );

    } catch (error) {
        console.error('Ошибка:', error);
        toast('Ошибка при загрузке', 'error');
        confirmUpload.disabled = false;
        cancelUpload.disabled = false;
        uploadProgress.style.display = 'none';
    }
});

window.deleteReplacement = async function (docId, imagePath) {
    if (!confirm('Удалить эту запись?')) return;

    try {
        if (imagePath) {
            const imageRef = ref(storage, imagePath);
            await deleteObject(imageRef).catch(() => { });
        }

        await deleteDoc(doc(db, 'replacements', docId));

        toast('Запись удалена');
        loadReplacements(replacementDate.value);

    } catch (error) {
        console.error('Ошибка удаления:', error);
        toast('Ошибка при удалении', 'error');
    }
};

window.openImageViewer = function (imageUrl) {
    viewerImage.src = imageUrl;
    currentZoom = 1;
    viewerImage.style.transform = `scale(${currentZoom})`;
    imageViewer.classList.add('active');
    document.body.style.overflow = 'hidden';
};

function closeImageViewer() {
    imageViewer.classList.remove('active');
    document.body.style.overflow = '';
    currentZoom = 1;
}

closeViewer.addEventListener('click', closeImageViewer);

imageViewer.addEventListener('click', (e) => {
    if (e.target === imageViewer) {
        closeImageViewer();
    }
});

zoomIn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.25, 3);
    viewerImage.style.transform = `scale(${currentZoom})`;
});

zoomOut.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.25, 0.5);
    viewerImage.style.transform = `scale(${currentZoom})`;
});

downloadImage.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = viewerImage.src;
    link.download = 'zameny.jpg';
    link.click();
});

let initialDistance = 0;

viewerImage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );
    }
});

viewerImage.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
        );

        const scale = currentDistance / initialDistance;
        currentZoom = Math.min(Math.max(currentZoom * scale, 0.5), 3);
        viewerImage.style.transform = `scale(${currentZoom})`;
        initialDistance = currentDistance;
    }
});

replacementDate.addEventListener('change', () => {
    loadReplacements(replacementDate.value);
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserRole = userDoc.data().role || 'user';
        }
    } catch (error) {
        console.error('Ошибка получения роли:', error);
    }

    if (currentUserRole === 'admin') {
        if (uploadBtn) uploadBtn.style.display = 'flex';
        if (adminNavItem) adminNavItem.style.display = 'flex';
    }

    document.getElementById('currentDate').textContent = getCurrentDate();
    replacementDate.value = getTodayISO();

    loadReplacements(getTodayISO());
});

console.log('Главная страница загружена');