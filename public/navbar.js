// Navbar mobile menu toggle, active link detection, and SPA navigation
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const icon = menuToggle?.querySelector('i');

    // Mobile menu toggle with smooth icon transition
    menuToggle?.addEventListener('click', () => {
        navMenu.classList.toggle('active');

        // Smooth icon transition
        if (icon) {
            if (icon.classList.contains('fa-bars')) {
                icon.style.transform = 'rotate(10deg)';
                setTimeout(() => {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                    icon.style.transform = 'rotate(0deg)';
                }, 150);
            } else {
                icon.style.transform = 'rotate(10deg)';
                setTimeout(() => {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                    icon.style.transform = 'rotate(0deg)';
                }, 150);
            }
        }
    });

    // ========================================
    // SPA Navigation Handler
    // ========================================

    /**
     * Handle SPA navigation for links with data-route attribute
     */
    function setupSPANavigation() {
        const navLinks = document.querySelectorAll('[data-route]');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const route = link.getAttribute('data-route');

                // Check if router is available (SPA mode)
                if (window.__router && route) {
                    e.preventDefault();

                    console.log('[navbar] SPA navigation to:', route);

                    // Navigate using the SPA router
                    window.__router.navigate(route);

                    // Update active link
                    updateActiveLink(route);

                    // Close mobile menu if open
                    closeMobileMenu();
                }
                // If no router, let the default link behavior happen (fallback)
            });
        });
    }

    /**
     * Update the active link based on current route
     */
    function updateActiveLink(currentRoute) {
        const navLinks = document.querySelectorAll('.navbar-links a[data-route]');

        navLinks.forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            link.classList.remove('active');

            // Exact match for routes
            if (linkRoute === currentRoute) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Close mobile menu
     */
    function closeMobileMenu() {
        if (navMenu?.classList.contains('active')) {
            navMenu.classList.remove('active');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                icon.style.transform = 'rotate(0deg)';
            }
        }
    }

    /**
     * Get current route from pathname
     */
    function getCurrentRoute() {
        let pathname = window.location.pathname;
        const baseTag = document.querySelector('base');
        if (baseTag) {
            const basePath = new URL(baseTag.href, window.location.origin).pathname.replace(/\/$/, '');
            if (basePath && pathname.startsWith(basePath)) {
                pathname = pathname.slice(basePath.length) || '/';
            }
        }
        // Normalize: treat /index.html and / as the same
        if (pathname === '/index.html' || pathname === '' || pathname === '/') {
            return '/';
        }
        // Remove .html extension if present
        return pathname.replace('.html', '');
    }

    // Set initial active link based on current route
    function setInitialActiveLink() {
        const currentRoute = getCurrentRoute();
        updateActiveLink(currentRoute);
    }

    // Setup SPA navigation
    setupSPANavigation();

    // Set initial active link
    setInitialActiveLink();

    // Listen for popstate events (browser back/forward) to update active link
    window.addEventListener('popstate', () => {
        const currentRoute = getCurrentRoute();
        updateActiveLink(currentRoute);
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navMenu && menuToggle) {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                closeMobileMenu();
            }
        }
    });

    // Close mobile menu when window is resized to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            closeMobileMenu();
        }
    });

    // ========================================
    // Navbar Info Button Handler & Welcome Card Switcher
    // ========================================

    const navbarInfoBtn = document.getElementById('navbar-info-btn');
    const globalInfoModalOverlay = document.getElementById('global-info-modal-overlay');
    const globalInfoModalClose = document.getElementById('global-info-modal-close');
    
    // Welcome card switcher state
    let currentCardIdx = 0;

    /**
     * Update the card display
     */
    function updateCardDisplay() {
        const panels = document.querySelectorAll('.info-switcher-panel');
        const prevBtn = document.getElementById('info-card-prev');
        const nextBtn = document.getElementById('info-card-next');

        panels.forEach((panel, idx) => {
            panel.classList.toggle('active', idx === currentCardIdx);
        });

        if (prevBtn) prevBtn.disabled = currentCardIdx === 0;
        if (nextBtn) nextBtn.disabled = currentCardIdx === panels.length - 1;
    }

    if (navbarInfoBtn && globalInfoModalOverlay) {
        // Auto-open modal on page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                globalInfoModalOverlay.classList.add('active');
                currentCardIdx = 0;
                updateCardDisplay();
            }, 500); // Small delay to ensure DOM is fully ready
        });

        navbarInfoBtn.addEventListener('click', () => {
            globalInfoModalOverlay.classList.add('active');
            currentCardIdx = 0; // Reset to first card when opening
            updateCardDisplay();
        });

        if (globalInfoModalClose) {
            globalInfoModalClose.addEventListener('click', () => {
                globalInfoModalOverlay.classList.remove('active');
            });
        }

        // Close on overlay click (outside modal)
        globalInfoModalOverlay.addEventListener('click', (e) => {
            if (e.target === globalInfoModalOverlay) {
                globalInfoModalOverlay.classList.remove('active');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && globalInfoModalOverlay.classList.contains('active')) {
                globalInfoModalOverlay.classList.remove('active');
            }
        });

        // Setup card navigation
        const prevBtn = document.getElementById('info-card-prev');
        const nextBtn = document.getElementById('info-card-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentCardIdx > 0) {
                    currentCardIdx--;
                    updateCardDisplay();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const panels = document.querySelectorAll('.info-switcher-panel');
                if (currentCardIdx < panels.length - 1) {
                    currentCardIdx++;
                    updateCardDisplay();
                }
            });
        }
    }

    // Expose updateActiveLink for external use (e.g., after programmatic navigation)
    window.__updateNavbarActiveLink = updateActiveLink;
});
