import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const errorText = document.getElementById('errorText');
const loginBtn = document.getElementById('loginBtn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorText.textContent = '';
    passwordInput.classList.remove('error');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Вход...';

    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');
    const remember = formData.get('remember');

    try {
        const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        await signInWithEmailAndPassword(auth, email, password);

        window.location.href = 'index.html';
    } catch (error) {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Войти';

        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorText.textContent = 'Неверный email или пароль';
        } else if (error.code === 'auth/too-many-requests') {
            errorText.textContent = 'Слишком много попыток, попробуйте позже';
        } else {
            errorText.textContent = 'Ошибка входа';
        }
        passwordInput.classList.add('error');
    }
});