/**
 * loading-screen.js
 * Handles the initial loading screen display and transition
 */

/**
 * Initializes the loading screen
 */
export function initializeLoadingScreen() {
    // Create loading screen element
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    
    // Create stylized loading text
    const loadingText = document.createElement('h1');
    loadingText.className = 'loading-title';
    loadingText.innerHTML = `
        <span class="load-letter">L</span>
        <span class="load-letter">O</span>
        <span class="ink-letters">A</span>
        <span class="ink-letters">D</span>
        <span class="ink-letters">I</span>
        <span class="load-letter">N</span>
        <span class="load-letter">G</span>
    `;
    
    // Add a subtitle
    const subtitle = document.createElement('p');
    subtitle.className = 'loading-subtitle';
    subtitle.textContent = 'Preparing paint buckets...';
    
    // Append elements
    loadingScreen.appendChild(loadingText);
    loadingScreen.appendChild(subtitle);
    document.body.appendChild(loadingScreen);
}

/**
 * Hides the loading screen when the game is ready
 */
export function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            if (loadingScreen.parentNode) {
                loadingScreen.parentNode.removeChild(loadingScreen);
            }
        }, 1000); // Remove after fade out animation
    }
}