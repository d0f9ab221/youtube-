// YouTube API Configuration
const API_KEY = 'AIzaSyCMAe3YZ9pGseXKJZnsRcEUcg2ZHIPBIEg';
const API_URL = 'https://www.googleapis.com/youtube/v3/';

// DOM Elements
const channelInput = document.getElementById('channelInput');
const fetchBtn = document.getElementById('fetchBtn');
const errorContainer = document.getElementById('errorContainer');
const subscriberCount = document.getElementById('subscriberCount');
const videoCount = document.getElementById('videoCount');
const viewCount = document.getElementById('viewCount');
const subChange = document.getElementById('subChange');
const channelTitle = document.getElementById('channelTitle');
const channelDescription = document.getElementById('channelDescription');
const channelIcon = document.getElementById('channelIcon');
const channelJoined = document.getElementById('channelJoined');
const channelCountry = document.getElementById('channelCountry');
const requestCount = document.getElementById('requestCount');

// State
let currentChannelId = null;
let subscriberHistory = [];
let requestCounter = 0;
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set initial placeholder
    channelInput.value = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // MKBHD default
    
    // Add event listeners
    fetchBtn.addEventListener('click', fetchChannelData);
    channelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchChannelData();
        }
    });
    
    // Initial fetch
    setTimeout(fetchChannelData, 500);
});

// Main function to fetch channel data
async function fetchChannelData() {
    const channelIdentifier = channelInput.value.trim();
    
    if (!channelIdentifier) {
        showError('Please enter a YouTube channel URL or ID');
        return;
    }
    
    // Hide previous errors
    errorContainer.style.display = 'none';
    
    // UI Loading state
    setLoadingState(true);
    
    try {
        // Determine if it's a URL or ID
        let channelId;
        
        if (isValidUrl(channelIdentifier)) {
            channelId = await extractChannelIdFromUrl(channelIdentifier);
            if (!channelId) {
                showError('Invalid YouTube channel URL');
                setLoadingState(false);
                return;
            }
        } else {
            channelId = channelIdentifier;
        }
        
        // Fetch channel data
        const channelData = await getChannelData(channelId);
        
        if (!channelData) {
            showError('Channel not found. Please check the ID/URL and try again.');
            setLoadingState(false);
            return;
        }
        
        // Update UI with channel data
        updateChannelInfo(channelData);
        
        // Start live polling if not already running
        if (!pollingInterval) {
            startLivePolling(channelId);
        }
        
        currentChannelId = channelId;
        
    } catch (error) {
        console.error('Error fetching channel data:', error);
        showError('Failed to fetch channel data. Please try again.');
        setLoadingState(false);
    }
}

// Get channel data from YouTube API
async function getChannelData(channelId) {
    const url = `${API_URL}channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        requestCounter++;
        requestCount.textContent = requestCounter;
        
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error in getChannelData:', error);
        throw error;
    }
}

// Extract channel ID from URL
async function extractChannelIdFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Handle different YouTube URL patterns
        if (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') {
            const path = parsedUrl.pathname;
            
            if (path.startsWith('/channel/')) {
                return path.split('/channel/')[1].split('?')[0];
            } else if (path.startsWith('/c/')) {
                // For custom URLs, need to convert to channel ID via API
                const customUrl = path.split('/c/')[1];
                return await getChannelIdFromCustomUrl(customUrl);
            }
        } else if (parsedUrl.hostname === 'youtu.be') {
            const videoId = parsedUrl.pathname.split('/')[1];
            // For youtu.be links, we need to get the channel from video
            return await getChannelIdFromVideoId(videoId);
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

// Get channel ID from custom URL (handle /c/username)
async function getChannelIdFromCustomUrl(customUrl) {
    try {
        const searchUrl = `${API_URL}search?part=id&q=${encodeURIComponent(customUrl)}&type=channel&key=${API_KEY}`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return data.items[0].id.channelId;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting channel from custom URL:', error);
        return null;
    }
}

// Get channel ID from video ID (for youtu.be links)
async function getChannelIdFromVideoId(videoId) {
    try {
        const videoUrl = `${API_URL}videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const response = await fetch(videoUrl);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return data.items[0].snippet.channelId;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting channel from video ID:', error);
        return null;
    }
}

// Update UI with channel information
function updateChannelInfo(channelData) {
    const snippet = channelData.snippet;
    const statistics = channelData.statistics;
    
    // Update channel title
    channelTitle.textContent = snippet.title;
    
    // Update description (truncate if too long)
    let description = snippet.description || 'No description available.';
    if (description.length > 200) {
        description = description.substring(0, 200) + '...';
    }
    channelDescription.textContent = description;
    
    // Update channel icon
    if (snippet.thumbnails && snippet.thumbnails.default) {
        channelIcon.src = snippet.thumbnails.default.url;
    } else {
        channelIcon.src = 'https://image.pollinations.ai/prompt/YouTube%20channel%20default%20avatar';
    }
    
    // Update join date
    if (snippet.publishedAt) {
        const date = new Date(snippet.publishedAt);
        channelJoined.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } else {
        channelJoined.textContent = 'N/A';
    }
    
    // Update country
    channelCountry.textContent = snippet.country || 'N/A';
    
    // Update statistics with formatting
    subscriberCount.textContent = formatNumber(statistics.subscriberCount);
    videoCount.textContent = formatNumber(statistics.videoCount);
    viewCount.textContent = formatNumber(statistics.viewCount);
    
    // Update change indicator (simulate based on history)
    updateChangeIndicator(statistics.subscriberCount);
    
    // Show success animation
    showSuccessAnimation();
}

// Start live polling for subscriber count
function startLivePolling(channelId) {
    // Clear existing interval if any
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    // Poll every 10 seconds
    pollingInterval = setInterval(async () => {
        try {
            const channelData = await getChannelData(channelId);
            
            if (channelData) {
                updateChannelInfo(channelData);
                
                // Update last updated time
                document.querySelector('.last-updated').textContent = 'Updated just now';
            }
        } catch (error) {
            console.error('Error in live polling:', error);
        }
    }, 10000);
}

// Update change indicator based on subscriber history
function updateChangeIndicator(currentSubscribers) {
    subscriberHistory.push(parseInt(currentSubscribers));
    
    // Keep only last 5 entries
    if (subscriberHistory.length > 5) {
        subscriberHistory.shift();
    }
    
    if (subscriberHistory.length >= 2) {
        const last = subscriberHistory[subscriberHistory.length - 1];
        const previous = subscriberHistory[subscriberHistory.length - 2];
        const change = last - previous;
        
        if (change > 0) {
            subChange.innerHTML = `<i class="fas fa-arrow-up"></i> +${formatNumber(change)} today`;
            subChange.style.color = 'var(--success-color)';
        } else if (change < 0) {
            subChange.innerHTML = `<i class="fas fa-arrow-down"></i> -${formatNumber(Math.abs(change))} today`;
            subChange.style.color = 'var(--danger-color)';
        } else {
            subChange.innerHTML = '+0 today';
            subChange.style.color = 'var(--text-secondary)';
        }
    } else {
        subChange.innerHTML = '+0 today';
        subChange.style.color = 'var(--text-secondary)';
    }
}

// Format numbers with commas
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

// Show error message
function showError(message) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Clear error after 5 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}

// Set loading state
function setLoadingState(isLoading) {
    if (isLoading) {
        fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        fetchBtn.disabled = true;
        fetchBtn.style.opacity = '0.7';
        
        // Clear previous data
        subscriberCount.textContent = '--';
        videoCount.textContent = '--';
        viewCount.textContent = '--';
        channelTitle.textContent = 'Loading...';
        channelDescription.textContent = 'Fetching channel data...';
        channelIcon.src = 'https://image.pollinations.ai/prompt/YouTube%20channel%20default%20avatar';
        
    } else {
        fetchBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Fetch Subscribers';
        fetchBtn.disabled = false;
        fetchBtn.style.opacity = '1';
    }
}

// Show success animation
function showSuccessAnimation() {
    // Add a subtle animation to the subscriber count
    subscriberCount.style.transform = 'scale(1.1)';
    setTimeout(() => {
        subscriberCount.style.transform = 'scale(1)';
    }, 300);
}

// Validate YouTube URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Handle page visibility change to pause/resume polling
document.addEventListener('visibilitychange', () => {
    if (document.hidden && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    } else if (!document.hidden && currentChannelId && !pollingInterval) {
        startLivePolling(currentChannelId);
    }
});