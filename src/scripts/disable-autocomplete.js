/**
 * Disable Browser Autocomplete Script
 * To resolve user annoyance with browser autocomplete/password suggestions on click.
 */
(function () {
    'use strict';

    // Configuration
    const USE_READONLY_HACK = true; // Set to true to use the readonly-on-blur trick (most effective but invasive)

    function disableAutocomplete(element) {
        if (!element) return;

        // 1. Basic attribute setting
        element.setAttribute('autocomplete', 'off');
        element.setAttribute('autocorrect', 'off');
        element.setAttribute('autocapitalize', 'off');
        element.setAttribute('spellcheck', 'false');

        // 2. Specialized handling for name/email/password fields to confuse browsers
        const type = element.getAttribute('type');
        const name = element.getAttribute('name');

        // If it's a password field, 'new-password' is often respected better than 'off'
        if (type === 'password') {
            element.setAttribute('autocomplete', 'new-password');
        }

        // 3. Randomize name attribute if it's not critical for form submission (optional, risky for existing logic)
        // We skip this to avoid breaking app logic that relies on names.

        // 4. The "Readonly" Hack
        // Browsers generally won't offer autofill for readonly fields.
        // We make it readonly until the user focuses/clicks it.
        if (USE_READONLY_HACK) {
            // Only apply if not already readonly
            if (!element.hasAttribute('readonly')) {
                element.setAttribute('readonly', 'true');
                element.style.cursor = 'text'; // Maintain text cursor

                // Remove readonly on focus/click
                const removeReadonly = () => {
                    if (element.hasAttribute('readonly')) {
                        element.removeAttribute('readonly');
                        // Re-focus might be needed in some edge cases, but usually click handles it
                    }
                };

                element.addEventListener('focus', removeReadonly);
                element.addEventListener('click', removeReadonly);

                // Re-apply readonly on blur to reset the protection
                element.addEventListener('blur', () => {
                    // Only re-apply if it's empty, otherwise it might look weird? 
                    // Actually, keeping it writable while it has content is fine.
                    // But if we re-apply readonly, the user has to click twice to edit again?
                    // Let's only Apply it ONCE at initialization. 
                    // Wait, if we don't re-apply, next time they click, autofill might begin?
                    // Usually autofill triggers on initial focus.
                    // Let's stick to initial load. Re-applying might be annoying.
                });
            }
        }
    }

    // Apply to existing inputs
    function applyToAll() {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(disableAutocomplete);
    }

    // Initial run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyToAll);
    } else {
        applyToAll();
    }

    // Observe for new elements (SPA support)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                            disableAutocomplete(node);
                        } else {
                            // Check children
                            const children = node.querySelectorAll('input, textarea');
                            children.forEach(disableAutocomplete);
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[DisableAutocomplete] Initialized. Browser autofill should be suppressed.');
})();
