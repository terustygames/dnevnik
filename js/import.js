import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, addDoc, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const profileBtn = document.getElementById('profileBtn');

let selectedFiles = {
    schedule: null,
    grades: null,
    students: null
};

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
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    if (type === 'error') {
        toast.style.background = '#e74c3c';
    } else if (type === 'warning') {
        toast.style.background = '#f39c12';
    } else {
        toast.style.background = '#27ae60';
    }

    toast.style.cssText += `
        position: fixed;
        top: 20px;
        right: 20px;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 300px;
        font-weight: 500;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function setupDropzone(dropzoneId, fileInputId, type) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
            selectedFiles[type] = file;
            updateDropzoneDisplay(dropzone, file);
        } else {
            showToast('Пожалуйста, выберите файл Excel (.xlsx, .xls, .csv)', 'error');
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFiles[type] = file;
            updateDropzoneDisplay(dropzone, file);
        }
    });
}

function updateDropzoneDisplay(dropzone, file) {
    dropzone.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <p style="font-weight: 600; color: #333;">${file.name}</p>
        <p class="dropzone-sub">${(file.size / 1024).toFixed(2)} KB</p>
    `;
}

async function importData(type) {
    const file = selectedFiles[type];

    if (!file) {
        showToast('Пожалуйста, выберите файл для импорта', 'warning');
        return;
    }

    const importBtn = document.querySelector(`.import-btn[data-type="${type}"]`);
    const originalText = importBtn.textContent;
    importBtn.disabled = true;
    importBtn.textContent = 'Импорт...';

    try {
        const reader = new FileReader();

        reader.onload = async (e) => {
            // Имитация обработки
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Сохраняем историю импорта
            await addDoc(collection(db, 'import_history'), {
                type: type,
                fileName: file.name,
                fileSize: file.size,
                importedAt: new Date().toISOString(),
                status: 'success',
                importedBy: auth.currentUser.uid
            });

            showToast(`Данные "${getTypeLabel(type)}" успешно импортированы!`);
            selectedFiles[type] = null;

            // Сбрасываем dropzone
            const dropzone = document.getElementById(`${type}Dropzone`);
            dropzone.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <p>Перетащите файл сюда</p>
                <p class="dropzone-sub">или нажмите для выбора</p>
            `;

            importBtn.disabled = false;
            importBtn.textContent = originalText;

            // Обновляем историю
            loadImportHistory();
        };

        reader.onerror = async () => {
            showToast('Ошибка чтения файла', 'error');
            importBtn.disabled = false;
            importBtn.textContent = originalText;
        };

        reader.readAsArrayBuffer(file);

    } catch (error) {
        console.error('Ошибка импорта:', error);
        showToast('Ошибка при импорте файла', 'error');

        await addDoc(collection(db, 'import_history'), {
            type: type,
            fileName: file.name,
            fileSize: file.size,
            importedAt: new Date().toISOString(),
            status: 'error',
            error: error.message,
            importedBy: auth.currentUser.uid
        });

        importBtn.disabled = false;
        importBtn.textContent = originalText;
    }
}

async function loadImportHistory() {
    try {
        const historyRef = collection(db, 'import_history');
        const q = query(historyRef, orderBy('importedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const historyBody = document.getElementById('historyBody');
        historyBody.innerHTML = '';

        if (querySnapshot.empty) {
            historyBody.innerHTML = `
                <div class="history-empty">
                    <p>История импорта пуста</p>
                </div>
            `;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const date = new Date(data.importedAt);
            const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

            const statusClass = data.status === 'success' ? 'status-success' :
                data.status === 'error' ? 'status-error' : 'status-processing';

            historyItem.innerHTML = `
                <span>${data.fileName}</span>
                <span>${getTypeLabel(data.type)}</span>
                <span>${formattedDate}</span>
                <span class="status-badge ${statusClass}">${getStatusLabel(data.status)}</span>
            `;

            historyBody.appendChild(historyItem);
        });

    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
        const historyBody = document.getElementById('historyBody');
        historyBody.innerHTML = `
            <div class="history-empty">
                <p>Ошибка загрузки истории</p>
            </div>
        `;
    }
}

function getTypeLabel(type) {
    const labels = {
        'schedule': 'Расписание',
        'grades': 'Оценки',
        'students': 'Студенты'
    };
    return labels[type] || type;
}

function getStatusLabel(status) {
    const labels = {
        'success': 'Успешно',
        'error': 'Ошибка',
        'processing': 'Обработка'
    };
    return labels[status] || status;
}

// Инициализация обработчиков событий
function init() {
    // Сайдбар
    if (menuBtn) {
        menuBtn.addEventListener('click', openSidebar);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });

    // Профиль
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }

    // Настройка dropzone для каждого типа
    setupDropzone('scheduleDropzone', 'scheduleFile', 'schedule');
    setupDropzone('gradesDropzone', 'gradesFile', 'grades');
    setupDropzone('studentsDropzone', 'studentsFile', 'students');

    // Кнопки импорта
    const importBtns = document.querySelectorAll('.import-btn');
    importBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            importData(type);
        });
    });

    // Загрузка истории импорта
    loadImportHistory();
}

// Проверка авторизации
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        init();
    }
});

console.log('Страница импорта загружена');