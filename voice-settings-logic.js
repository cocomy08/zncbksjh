/**
 * voice-settings-logic.js
 * 
 * Handles logic for the Voice Settings page, specifically the "Test Connection" / "Sound Test" animation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initVoiceSettings();
});

function initVoiceSettings() {
    // Locate the Test TTS button logic
    const testTtsBtn = document.getElementById('test-tts-button');
    const soundTestCard = document.getElementById('sound-test-card');
    const statusText = document.getElementById('tts-test-status');

    if (!testTtsBtn || !soundTestCard) return;

    let isPlaying = false;
    let waveContainer = null;
    let playbackTimer = null;

    testTtsBtn.addEventListener('click', () => {
        // If currently playing, manual stop should clear the timer
        if (isPlaying) {
            clearTimeout(playbackTimer);
        }
        
        isPlaying = !isPlaying;
        updateUI(isPlaying);

        // If we just started playing, set a timer to auto-stop
        if (isPlaying) {
            playbackTimer = setTimeout(() => {
                isPlaying = false;
                updateUI(false);
            }, 3000); // Stop after 3 seconds
        }
    });

    function updateUI(playing) {
        if (playing) {
            // --- Playing State ---
            
            // 1. Update Button
            testTtsBtn.classList.remove('bg-[#007AFF]', 'text-white', 'hover:bg-[#0062CC]', 'shadow-xl');
            testTtsBtn.classList.add('bg-white', 'text-black', 'scale-110', 'shadow-2xl');
            
            // Icon: Square (Stop)
            testTtsBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 fill-current">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                </svg>
            `;

            // 2. Update Card Background
            soundTestCard.classList.remove('bg-white');
            soundTestCard.classList.add('bg-[#1D1D1F]', 'border-black/5');
            // soundTestCard.style.backgroundColor = '#1D1D1F'; // Force if needed, but class is better

            // 3. Update Text Colors
            if (statusText) {
                statusText.textContent = "Playing...";
                statusText.classList.remove('text-[#1D1D1F]');
                statusText.classList.add('text-white');
            }
            const label = soundTestCard.querySelector('.font-bold.uppercase');
            if (label) {
                label.classList.remove('text-black/40');
                label.classList.add('text-white/40');
            }

            // 4. Inject Waveform
            if (!waveContainer) {
                waveContainer = document.createElement('div');
                waveContainer.className = 'absolute inset-0 flex items-center justify-center gap-1 opacity-20 pointer-events-none';
                
                // Create 20 bars
                for (let i = 0; i < 20; i++) {
                    const bar = document.createElement('div');
                    bar.className = 'w-2 bg-white rounded-full animate-pulse voice-wave-bar';
                    
                    // Random height (20% to 80%) and duration (0.3s to 0.8s)
                    const height = Math.random() * 60 + 20; 
                    const duration = Math.random() * 0.5 + 0.3;
                    
                    bar.style.height = `${height}%`;
                    bar.style.animationDuration = `${duration}s`;
                    
                    waveContainer.appendChild(bar);
                }
                soundTestCard.insertBefore(waveContainer, soundTestCard.firstChild);
            }

        } else {
            // --- Stopped State ---

            // 1. Update Button
            testTtsBtn.classList.remove('bg-white', 'text-black', 'scale-110', 'shadow-2xl');
            testTtsBtn.classList.add('bg-[#007AFF]', 'text-white', 'hover:bg-[#0062CC]', 'shadow-xl');
            
            // Icon: Play
            testTtsBtn.innerHTML = `
                <i data-lucide="play" class="w-6 h-6 fill-current ml-1"></i>
            `;
            // Re-render lucide icons
            if (window.lucide && window.lucide.createIcons) {
                window.lucide.createIcons();
            }

            // 2. Update Card Background
            soundTestCard.classList.remove('bg-[#1D1D1F]');
            soundTestCard.classList.add('bg-white');
            // soundTestCard.style.backgroundColor = '';

            // 3. Update Text Colors
            if (statusText) {
                statusText.textContent = "tap to play.";
                statusText.classList.remove('text-white');
                statusText.classList.add('text-[#1D1D1F]');
            }
            const label = soundTestCard.querySelector('.font-bold.uppercase');
            if (label) {
                label.classList.remove('text-white/40');
                label.classList.add('text-black/40');
            }

            // 4. Remove Waveform
            if (waveContainer) {
                waveContainer.remove();
                waveContainer = null;
            }
        }
    }
}
