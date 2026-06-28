// Global Application State
let appData = {
    releases: [],
    lastFetched: null,
    currentFilter: 'all',
    searchQuery: ''
};

// DOM Elements
const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    syncStatus: document.getElementById('syncStatus'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    
    // Stats
    statTotal: document.getElementById('statTotal').querySelector('.stat-value'),
    statFeatures: document.getElementById('statFeatures').querySelector('.stat-value'),
    statChanges: document.getElementById('statChanges').querySelector('.stat-value'),
    statDeprecations: document.getElementById('statDeprecations').querySelector('.stat-value'),
    
    // Search & Filter
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterChips: document.getElementById('filterChips'),
    
    // States & Feed
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    emptyState: document.getElementById('emptyState'),
    releaseFeed: document.getElementById('releaseFeed'),
    
    // Tweet Modal
    tweetModal: document.getElementById('tweetModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelTweetBtn: document.getElementById('cancelTweetBtn'),
    publishTweetBtn: document.getElementById('publishTweetBtn'),
    tweetTextarea: document.getElementById('tweetTextarea'),
    tweetLinkSpan: document.getElementById('tweetLinkSpan'),
    charCount: document.getElementById('charCount'),
    progressBar: document.getElementById('progressBar'),
    charProgressRing: document.querySelector('.char-progress-ring')
};

// Tweet Modal State
let activeTweetData = {
    text: '',
    link: ''
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh & Retry
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    elements.retryBtn.addEventListener('click', () => fetchReleases(true));
    
    // Search Inputs
    elements.searchInput.addEventListener('input', handleSearch);
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.clearSearchBtn.style.display = 'none';
        handleSearch();
    });
    
    // Filter Chips
    elements.filterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        
        // Toggle Active Class
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        appData.currentFilter = chip.dataset.type;
        renderFeed();
    });
    
    // Tweet Modal Events
    elements.closeModalBtn.addEventListener('click', closeTweetModal);
    elements.cancelTweetBtn.addEventListener('click', closeTweetModal);
    elements.tweetTextarea.addEventListener('input', updateTweetCharCount);
    elements.publishTweetBtn.addEventListener('click', publishTweet);
    
    // Close modal on clicking overlay
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeTweetModal();
    });
    
    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.tweetModal.classList.contains('open')) {
            closeTweetModal();
        }
    });
}

// Fetch Releases from Backend API
async function fetchReleases(force = false) {
    showLoading();
    
    if (force) {
        elements.refreshBtn.classList.add('loading');
        updateSyncStatus('syncing', 'Syncing latest release notes...');
    }
    
    try {
        const url = `/api/releases${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Unknown backend error');
        }
        
        appData.releases = data.releases;
        appData.lastFetched = data.last_fetched;
        
        updateStats();
        renderFeed();
        
        const lastFetchedDate = new Date(appData.lastFetched * 1000);
        const timeString = lastFetchedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        updateSyncStatus('active', `Synced at ${timeString}`);
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
        updateSyncStatus('error', 'Sync failed');
    } finally {
        elements.refreshBtn.classList.remove('loading');
    }
}

// Helper to normalize the update type into 'feature', 'change', or 'deprecation'
function normalizeType(typeStr) {
    if (!typeStr) return 'general';
    const t = typeStr.toLowerCase().trim();
    if (t.includes('feature')) return 'feature';
    if (t.includes('change')) return 'change';
    if (t.includes('deprecation') || t.includes('notice') || t.includes('security') || t.includes('announcement')) return 'deprecation';
    return 'general';
}

// Update Sync Status Banner
function updateSyncStatus(state, message) {
    elements.statusDot.className = 'status-dot';
    elements.statusText.textContent = message;
    
    if (state === 'syncing') {
        elements.statusDot.classList.add('syncing');
    } else if (state === 'error') {
        elements.statusDot.classList.add('error');
    }
}

// Update Stats Dashboard Cards
function updateStats() {
    let total = 0;
    let features = 0;
    let changes = 0;
    let deprecations = 0;
    
    appData.releases.forEach(entry => {
        entry.updates.forEach(update => {
            total++;
            const type = normalizeType(update.type);
            if (type === 'feature') features++;
            else if (type === 'change') changes++;
            else if (type === 'deprecation') deprecations++;
        });
    });
    
    elements.statTotal.textContent = total;
    elements.statFeatures.textContent = features;
    elements.statChanges.textContent = changes;
    elements.statDeprecations.textContent = deprecations;
}

// Handle Keyword Search Input
function handleSearch() {
    appData.searchQuery = elements.searchInput.value.toLowerCase().trim();
    elements.clearSearchBtn.style.display = appData.searchQuery ? 'block' : 'none';
    renderFeed();
}

// Renders the release feed based on filters and search queries
function renderFeed() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.releaseFeed.style.display = 'none';
    elements.releaseFeed.innerHTML = '';
    
    let renderedCount = 0;
    
    // Sort releases by date descending (already done by feed, but safety check)
    appData.releases.forEach(entry => {
        // Filter sub-updates
        const matchingUpdates = entry.updates.filter(update => {
            const normalized = normalizeType(update.type);
            const matchesFilter = (appData.currentFilter === 'all') || (appData.currentFilter === normalized);
            
            const matchesSearch = !appData.searchQuery || 
                update.type.toLowerCase().includes(appData.searchQuery) ||
                update.description_text.toLowerCase().includes(appData.searchQuery) ||
                entry.date.toLowerCase().includes(appData.searchQuery);
                
            return matchesFilter && matchesSearch;
        });
        
        if (matchingUpdates.length > 0) {
            renderedCount += matchingUpdates.length;
            
            // Create day group element
            const dayGroup = document.createElement('div');
            dayGroup.className = 'day-group';
            
            // Header for the date group
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `
                <span class="day-title">${entry.date}</span>
                <div class="day-line"></div>
            `;
            dayGroup.appendChild(dayHeader);
            
            // Add updates under this day group
            matchingUpdates.forEach(update => {
                const normType = normalizeType(update.type);
                const card = document.createElement('div');
                card.className = `update-card ${normType}`;
                
                card.innerHTML = `
                    <div class="update-card-header">
                        <div class="update-badge-container">
                            <span class="type-badge ${normType}">${update.type}</span>
                            <span class="update-date">${entry.date}</span>
                        </div>
                        <div class="card-actions-top">
                            <button class="btn-card-action tweet-btn-card" title="Compose a Tweet about this update">
                                <i class="fa-brands fa-x-twitter"></i> Tweet
                            </button>
                            <a href="${entry.link}" target="_blank" rel="noopener" class="btn-card-action" title="View original release notes on Google Cloud Docs">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Original
                            </a>
                        </div>
                    </div>
                    <div class="update-card-content">
                        ${update.description_html}
                    </div>
                `;
                
                // Attach tweet handler to the button
                const tweetBtn = card.querySelector('.tweet-btn-card');
                tweetBtn.addEventListener('click', () => openTweetModal(entry.date, update, entry.link));
                
                dayGroup.appendChild(card);
            });
            
            elements.releaseFeed.appendChild(dayGroup);
        }
    });
    
    if (renderedCount === 0) {
        elements.emptyState.style.display = 'flex';
    } else {
        elements.releaseFeed.style.display = 'flex';
    }
}

// UI State Management Helpers
function showLoading() {
    elements.loadingState.style.display = 'flex';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.releaseFeed.style.display = 'none';
}

function showError(msg) {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'flex';
    elements.emptyState.style.display = 'none';
    elements.releaseFeed.style.display = 'none';
    elements.errorMessage.textContent = msg || 'Could not load release notes.';
}

// Tweet Dialog Interactions
function openTweetModal(date, update, link) {
    activeTweetData.link = link;
    
    // Construct default clean tweet text
    // E.g., BigQuery Feature (June 25, 2026): You can now use the VECTOR_SEARCH function to combine semantic and lexical search...
    const cleanDesc = update.description_text;
    const headerPrefix = `BigQuery ${update.type} (${date}): `;
    const suffix = ` #BigQuery #GoogleCloud`;
    
    // We want the total length, including the link (Twitter counts any link as exactly 23 chars).
    // Available length for description: 280 - headerPrefix.length - 23 (link) - suffix.length - 2 (spaces)
    const availableLength = 280 - headerPrefix.length - 23 - suffix.length - 2;
    
    let truncatedDesc = cleanDesc;
    if (cleanDesc.length > availableLength) {
        truncatedDesc = cleanDesc.slice(0, availableLength - 3) + '...';
    }
    
    const defaultTweetBody = `${headerPrefix}${truncatedDesc}${suffix}`;
    
    // Pre-populate input elements
    elements.tweetTextarea.value = defaultTweetBody;
    elements.tweetLinkSpan.textContent = link;
    
    updateTweetCharCount();
    
    // Display Modal
    elements.tweetModal.style.display = 'flex';
    // Force reflow
    elements.tweetModal.offsetHeight;
    elements.tweetModal.classList.add('open');
    elements.tweetTextarea.focus();
}

function closeTweetModal() {
    elements.tweetModal.classList.remove('open');
    setTimeout(() => {
        elements.tweetModal.style.display = 'none';
    }, 250); // Matches transition duration
}

// Calculate Twitter-compliant Character Count
// Twitter counts any URL as exactly 23 characters.
function calculateTwitterChars(text, link) {
    let charLength = text.length;
    
    // In our composer, we list the link in a preview box and it gets appended in the actual tweet intent.
    // If the composer text contains other links, Twitter will count them as 23 chars too.
    // However, our standard composer text contains just the typed text, and we append the main release note link.
    // So the character count should be: text length + 1 (space) + 23 (link).
    // Let's also check if user has manually pasted additional links inside the textarea.
    const urlRegex = /https?:\/\/[^\s]+/g;
    const matches = text.match(urlRegex) || [];
    
    let textLengthWithoutUrls = text;
    matches.forEach(url => {
        textLengthWithoutUrls = textLengthWithoutUrls.replace(url, '');
    });
    
    // Every url in the textarea costs 23 chars
    const textareaUrlCount = matches.length * 23;
    
    // The main link (which is appended) costs 23 chars
    const mainLinkCount = link ? 24 : 0; // 23 for link, 1 for prepended space
    
    return textLengthWithoutUrls.length + textareaUrlCount + mainLinkCount;
}

// Update Tweet character counter and circular progress ring
function updateTweetCharCount() {
    const text = elements.tweetTextarea.value;
    const totalChars = calculateTwitterChars(text, activeTweetData.link);
    
    elements.charCount.textContent = totalChars;
    
    // Circular Progress Ring calculations
    const limit = 280;
    const percentage = Math.min((totalChars / limit) * 100, 100);
    const radius = 10;
    const circumference = 2 * Math.PI * radius; // 62.83
    
    const strokeDashoffset = circumference - (percentage / 100 * circumference);
    elements.progressBar.style.strokeDashoffset = strokeDashoffset;
    
    // Colors depending on limits
    elements.charProgressRing.className = 'char-progress-ring';
    if (totalChars >= limit) {
        elements.charProgressRing.classList.add('danger');
        elements.charCount.style.color = 'var(--color-danger)';
        elements.publishTweetBtn.disabled = true;
    } else if (totalChars >= limit - 20) {
        elements.charProgressRing.classList.add('warning');
        elements.charCount.style.color = 'var(--color-deprecation)';
        elements.publishTweetBtn.disabled = false;
    } else {
        elements.charCount.style.color = 'var(--text-secondary)';
        elements.publishTweetBtn.disabled = false;
    }
}

// Redirects user to Twitter intent page in a new window
function publishTweet() {
    const text = elements.tweetTextarea.value;
    const url = activeTweetData.link;
    
    // Construct X/Twitter Web Intent URL
    // We pass text and url parameters. Twitter automatically combines them.
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    
    window.open(intentUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
    closeTweetModal();
}
