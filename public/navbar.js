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
    // Reset Button Handler
    // ========================================

    const navbarResetBtn = document.getElementById('navbar-reset-btn');
    const mobileResetBtn = document.getElementById('mobile-reset-btn');

    function resetApp() {
        // Flag so the info modal doesn't auto-open after the reload
        sessionStorage.setItem('skipInfoModal', '1');
        // Strip query params and hash, then navigate to force a full reload.
        // Setting .search first then calling .reload() avoids the race
        // condition of replace() + reload() competing for navigation.
        const url = new URL(window.location.href);
        const hadParams = url.search || url.hash;
        url.search = '';
        url.hash = '';
        if (hadParams) {
            // URL changed — navigate to the clean URL (triggers full page load)
            window.location.replace(url.toString());
        } else {
            // URL is already clean — just force a reload
            window.location.reload();
        }
    }

    navbarResetBtn?.addEventListener('click', resetApp);
    mobileResetBtn?.addEventListener('click', () => {
        closeMobileMenu();
        resetApp();
    });

    // ========================================
    // Navbar Info Button Handler & Welcome Card Switcher
    // ========================================

    const navbarInfoBtn = document.getElementById('navbar-info-btn');
    const navbarCommentBtn = document.getElementById('navbar-comment-btn');
    const mobileInfoBtn = document.getElementById('mobile-info-btn');
    const mobileCommentBtn = document.getElementById('mobile-comment-btn');
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
        // Auto-open modal on page load (skip after reset)
        window.addEventListener('load', () => {
            if (sessionStorage.getItem('skipInfoModal')) {
                sessionStorage.removeItem('skipInfoModal');
                return;
            }
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

        // Comment button opens to last page (issue submission)
        if (navbarCommentBtn) {
            navbarCommentBtn.addEventListener('click', () => {
                globalInfoModalOverlay.classList.add('active');
                const panels = document.querySelectorAll('.info-switcher-panel');
                currentCardIdx = panels.length - 1; // Go to last card
                updateCardDisplay();
            });
        }

        // Mobile menu buttons — same behavior, also close the menu
        if (mobileInfoBtn) {
            mobileInfoBtn.addEventListener('click', () => {
                globalInfoModalOverlay.classList.add('active');
                currentCardIdx = 0;
                updateCardDisplay();
                closeMobileMenu();
            });
        }

        if (mobileCommentBtn) {
            mobileCommentBtn.addEventListener('click', () => {
                globalInfoModalOverlay.classList.add('active');
                const panels = document.querySelectorAll('.info-switcher-panel');
                currentCardIdx = panels.length - 1;
                updateCardDisplay();
                closeMobileMenu();
            });
        }

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

    // ========================================
    // Issue Report Form Handler
    // ========================================
    const issueReportForm = document.getElementById('issue-report-form');
    const issueStatus = document.getElementById('issue-status');

    if (issueReportForm) {
        issueReportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const description = document.getElementById('issue-description').value;
            
            // Show loading state
            issueStatus.className = 'issue-status loading';
            issueStatus.textContent = 'Submitting issue...';
            
            try {
                const response = await fetch('/api/submit-issue', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        description,
                        url: window.location.href,
                        userAgent: navigator.userAgent
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    issueStatus.className = 'issue-status success';
                    issueStatus.textContent = `Issue submitted successfully! Issue #${data.issueNumber}`;
                    issueReportForm.reset();
                    
                    // Hide success message after 5 seconds
                    setTimeout(() => {
                        issueStatus.style.display = 'none';
                    }, 5000);
                } else {
                    throw new Error(data.error || 'Failed to submit issue');
                }
            } catch (error) {
                issueStatus.className = 'issue-status error';
                issueStatus.textContent = `Error: ${error.message}. Please try emailing rafsehelp@ucar.edu instead.`;
            }
        });
    }

    // Expose updateActiveLink for external use (e.g., after programmatic navigation)
    window.__updateNavbarActiveLink = updateActiveLink;
});
