/**
 * StayVerse Client-Side Micro-interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  // User Dropdown Menu
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdownContent = document.getElementById('userDropdownContent');

  if (userMenuBtn && userDropdownContent) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownContent.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuBtn.contains(e.target)) {
        userDropdownContent.classList.remove('show');
      }
    });
  }

  // Auto-dismiss Flash Alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach((alert) => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.4s ease';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 400);
    }, 5000);
  });
});
