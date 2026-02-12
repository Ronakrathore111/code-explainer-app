const wrapper = document.querySelector('.wrapper');
const signUpBtnLink = document.querySelector('.signUpBtn-link');
const signInBtnLink = document.querySelector('.signInBtn-link');
const rememberMeCheckbox = document.getElementById('rememberMe');
const loginEmailInput = document.getElementById('loginEmail');
const signupEmailInput = document.getElementById('signupEmail');

/**
 * 1. INITIALIZATION & REMEMBER ME 
 * Handles pre-filling the login form on page load.
 */
window.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    
    if (savedEmail && loginEmailInput) {
        // Pre-fill only the login field
        loginEmailInput.value = savedEmail;
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        
        // Apply visual 'success' state to floating label
        const group = loginEmailInput.closest('.input-group');
        if (group) group.classList.add('success');
        
        // Ensure Sign Up remains clean
        if (signupEmailInput) {
            signupEmailInput.value = '';
            signupEmailInput.closest('.input-group').classList.remove('success');
        }
    }
});

/**
 * 2. FORM SWITCHING LOGIC
 * Animates transitions and resets form states.
 */
function switchForm(isActive) {
    wrapper.classList.toggle('active', isActive);
    clearErrors();
    
    // If switching to Sign Up, reset that form specifically
    if (isActive) {
        document.getElementById('signupForm').reset();
    }
}

if (signUpBtnLink) signUpBtnLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchForm(true);
});

if (signInBtnLink) signInBtnLink.addEventListener('click', (e) => {
    e.preventDefault();
    switchForm(false);
});

function clearErrors() {
    document.querySelectorAll('.input-group').forEach(group => {
        group.classList.remove('error', 'success');
    });
}

/**
 * 3. AUTHENTICATION HANDLER
 * Consolidates Login and Signup logic.
 */
const authForms = document.querySelectorAll('form');

authForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const isLogin = e.target.closest('.sign-in');
        const emailInput = e.target.querySelector('input[type="email"]');
        const passwordInput = e.target.querySelector('input[type="password"]');
        const usernameInput = e.target.querySelector('input[type="text"]');
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const username = usernameInput ? usernameInput.value.trim() : null;
        
        // Validation
        let isValid = true;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            emailInput.closest('.input-group').classList.add('error');
            showNotification('Valid email is required');
            isValid = false;
        }
        
        if (!password || password.length < 6) {
            passwordInput.closest('.input-group').classList.add('error');
            showNotification('Password must be at least 6 characters');
            isValid = false;
        }

        if (!isValid) return;
        
        const button = form.querySelector('button');
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const endpoint = isLogin ? '/login' : '/signup';
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, ...(username && { username }) })
            });

            const data = await res.json();
            
            if (res.ok) {
                if (isLogin) {
                    // Handle Remember Me
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('rememberedEmail', email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }

                    localStorage.setItem('userEmail', email);
                    showNotification('Login successful!', 'success');
                    setTimeout(() => window.location.href = "home.html", 500);
                } else {
                    showNotification('Account created! Please login.', 'success');
                    switchForm(false);
                }
            } else {
                showNotification(data.message || 'Authentication failed');
            }
        } catch (error) {
            showNotification('Connection error');
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    });
});

/**
 * 4. UI ENHANCEMENTS
 * Floating labels and Toast notifications.
 */
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        const group = this.closest('.input-group');
        if (group) {
            group.classList.remove('error');
            this.value.trim() ? group.classList.add('success') : group.classList.remove('success');
        }
    });
});

function showNotification(message, type = 'error') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span>`;
    
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
        color: white; padding: 14px 24px; border-radius: 12px;
        display: flex; align-items: center; gap: 12px;
        animation: slideIn 0.3s ease; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
const forgotModal = document.getElementById('forgotModal');
const forgotLink = document.getElementById('forgotPasswordLink');
const closeModal = document.querySelector('.close-modal');
const sendResetBtn = document.getElementById('sendResetBtn');

// Open Modal
forgotLink.onclick = (e) => {
    e.preventDefault();
    forgotModal.style.display = "block";
}

// Close Modal
closeModal.onclick = () => forgotModal.style.display = "none";
window.onclick = (event) => { if (event.target == forgotModal) forgotModal.style.display = "none"; }

// Handle Reset Request
sendResetBtn.onclick = async () => {
    const email = document.getElementById('resetEmail').value;
    if (!email) return showNotification("Please enter your email");

    sendResetBtn.disabled = true;
    sendResetBtn.innerText = "Sending...";

    try {
        const res = await fetch('/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (res.ok) {
            showNotification("Reset link sent to your email!", "success");
            forgotModal.style.display = "none";
        } else {
            showNotification("Email not found");
        }
    } catch (err) {
        showNotification("Connection error");
    } finally {
        sendResetBtn.disabled = false;
        sendResetBtn.innerText = "Send Reset Link";
    }
}
// Handle Reset Request in script.js
sendResetBtn.onclick = async () => {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) return showNotification("Please enter your email");

    sendResetBtn.disabled = true;
    sendResetBtn.innerText = "Sending...";

    try {
        // Use a relative path if the frontend is served by the same Express server
        const res = await fetch("/forgot-password", { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json();

        if (res.ok) {
            showNotification("Reset link sent to your email!", "success");
            forgotModal.style.display = "none";
        } else {
            // This catches the 'Email not found' 404 from your server
            showNotification(data.message || "Email not found", "error");
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        showNotification("Connection error. Is the server running?", "error");
    } finally {
        sendResetBtn.disabled = false;
        sendResetBtn.innerText = "Send Reset Link";
    }
}

// Initial Cleanup
clearErrors();