// Navigation JavaScript

let currentUser = null;

async function loadUser() {
  try {
    const response = await fetch('/api/user');
    const data = await response.json();
    if (data.user) {
      currentUser = data.user;
      updateNavigation();
    }
  } catch (error) {
    console.error('Error loading user:', error);
  }
}

function updateNavigation() {
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;
  
  navLinks.innerHTML = '';
  
  if (!currentUser) {
    // Not logged in - show only login
    const loginLink = document.createElement('a');
    loginLink.href = '/login.html';
    loginLink.textContent = 'Login';
    navLinks.appendChild(loginLink);
  } else {
    // Logged in - show all links
    const links = [
      { href: '/dashboard.html', text: 'Dashboard' },
      { href: '/ai.html', text: 'AI Assistant' },
      { href: '/practice.html', text: 'Driving Test Practice' },
      { href: '/learning.html', text: 'Learning Hub' },
      { href: '/resources.html', text: 'Resources' },
      { href: '/upload.html', text: 'Upload' },
      { href: '/problem.html', text: 'Ask Problem' },
      { href: '/about.html', text: 'About Us' }
    ];
    
    // Add admin link if admin
    if (currentUser.role === 'admin') {
      links.push({ href: '/admin.html', text: 'Admin' });
    }
    
    links.forEach(link => {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      if (window.location.pathname === link.href) {
        a.classList.add('active');
      }
      navLinks.appendChild(a);
    });
    
    // Add user info and logout
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
      userInfo.innerHTML = `
        <span>${currentUser.name}</span>
        <button class="logout-btn" onclick="logout()">Logout</button>
      `;
    }
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadUser);

