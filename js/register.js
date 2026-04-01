import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const registerForm = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const confirmPasswordInput = document.getElementById('confirmPassword');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const registerBtn = document.getElementById('registerBtn');

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    emailError.textContent = '';
    passwordError.textContent = '';
    emailInput.classList.remove('error');
    confirmPasswordInput.classList.remove('error');

    const formData = new FormData(registerForm);
    const fullName = formData.get('fullName');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password !== confirmPassword) {
        passwordError.textContent = 'Пароли не совпадают';
        confirmPasswordInput.classList.add('error');
        return;
    }

    if (password.length < 6) {
        passwordError.textContent = 'Пароль должен быть минимум 6 символов';
        confirmPasswordInput.classList.add('error');
        return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Регистрация...';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            fullName: fullName,
            email: email,
            role: 'user',
            createdAt: new Date().toISOString()
        });

        window.location.href = 'login.html';
    } catch (error) {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Зарегистрироваться';

        if (error.code === 'auth/email-already-in-use') {
            emailError.textContent = 'Пользователь с таким email уже существует';
            emailInput.classList.add('error');
        } else if (error.code === 'auth/invalid-email') {
            emailError.textContent = 'Неверный формат email';
            emailInput.classList.add('error');
        } else if (error.code === 'auth/weak-password') {
            passwordError.textContent = 'Слишком слабый пароль';
            confirmPasswordInput.classList.add('error');
        } else {
            emailError.textContent = 'Ошибка регистрации';
            emailInput.classList.add('error');
        }
    }
});