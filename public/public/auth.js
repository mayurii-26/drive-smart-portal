// Authentication JavaScript

let currentTab = 'login';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`${tab}-form`).classList.add('active');
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');
  
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      window.location.href = '/dashboard.html';
    } else {
      errorDiv.textContent = data.error || 'Login failed';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const errorDiv = document.getElementById('signup-error');
  
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
  
  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.style.display = 'block';
    return;
  }
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      errorDiv.textContent = 'Registration successful! Please login.';
      errorDiv.className = 'alert alert-success';
      errorDiv.style.display = 'block';
      setTimeout(() => {
        switchTab('login');
        document.getElementById('login-email').value = email;
      }, 2000);
    } else {
      errorDiv.textContent = data.error || 'Registration failed';
      errorDiv.className = 'alert alert-error';
      errorDiv.style.display = 'block';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.className = 'alert alert-error';
    errorDiv.style.display = 'block';
  }
}

async function checkAuth() {
  try {
    const response = await fetch('/api/user');
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    return null;
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
    window.location.href = '/login.html';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  
  // If on login page and already logged in, redirect
  if (window.location.pathname === '/login.html' || window.location.pathname === '/') {
    if (user) {
      window.location.href = '/dashboard.html';
    }
  } else {
    // If on protected page and not logged in, redirect
    if (!user) {
      window.location.href = '/login.html';
    }
  }
});

