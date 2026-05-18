// YouTube API Key (provided by user)
const API_KEY = 'AIzaSyCMAe3YZ9pGseXKJZnsRcEUcg2ZHIPBIEg';

// DOM Elements
const channelUrlInput = document.getElementById('channelUrl');
const fetchBtn = document.getElementById('fetchBtn');
const stopBtn = document.getElementById('stopBtn');
const refreshBtn = document.getElementById('refreshBtn');
const resultContainer = document.getElementById('result');
const errorContainer = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const lastUpdated = document.getElementById('lastUpdated');

// Channel info elements
const channelIcon = document.getElementById('channelIcon');
const channelTitle = document.getElementById('channelTitle');
const channelDesc = document.getElementById('channelDesc');
const subscriberCount = document.getElementById('subscriberCount');
const viewCount = document.getElementById('viewCount');
const videoCount = document.getElementById('videoCount');
const trend = document.getElementById('trend');

// Polling variables
let pollInterval = null;
let currentChannelId = null;
let previousSubscriberCount = null;

// Initialize
fetchBtn.addEventListener('click', fetchChannelData);
stopBtn.addEventListener('click', stopLiveUpdates);
refreshBtn.addEventListener('click', fetchChannelData);

function fetchChannelData() {
    const url = channelUrlInput.value.trim();
    
    if (!url) {
        showError('Please enter a YouTube channel URL');
        return;
    }
    
    // Hide previous results and errors
    resultContainer.style.display = 'none';
    errorContainer.style.display = 'none';
    
    // Disable fetch button and enable stop button
    fetchBtn.disabled = true;
    stopBtn.disabled = false;
    
    // Get channel ID from URL
    getChannelIdFromUrl(url)
        .then(channelId => {
            if (!channelId) {
                throw new Error('Could not extract channel ID from URL. Please check the URL format.');
            }
            
            currentChannelId = channelId;
            
            // Fetch channel data
            return fetchChannelStatistics(channelId);
        })
        .then(data => {
            displayChannelData(data);
            startLiveUpdates();
        })
        .catch(error => {
            showError(error.message);
            fetchBtn.disabled = false;
            stopBtn.disabled = true;
        });
}

async function getChannelIdFromUrl(url) {
    // Parse different YouTube URL formats
    try {
        const urlObj = new URL(url);
        
        // Case 1: Custom URL (youtube.com/@username)
        if (urlObj.pathname.startsWith('/@')) {
            const username = urlObj.pathname.slice(2);
            return await getChannelIdFromUsername(username);
        }
        
        // Case 2: Custom URL (youtube.com/c/username)
        if (urlObj.pathname.startsWith('/c/')) {
            const username = urlObj.pathname.slice(3);
            return await getChannelIdFromUsername(username);
        }
        
        // Case 3: Channel ID (youtube.com/channel/CHANNEL_ID)
        if (urlObj.pathname.startsWith('/channel/')) {
            return urlObj.pathname.split('/')[2];
        }
        
        // Case 4: User URL (youtube.com/user/USERNAME)
        if (urlObj.pathname.startsWith('/user/')) {
            const username = urlObj.pathname.split('/')[2];
            return await getChannelIdFromUsername(username);
        }
        
        // Case 5: Shortened URL (youtu.be/CHANNEL_ID)
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
        
        return null;
    } catch (e) {
        return null;
    }
}

async function getChannelIdFromUsername(username) {
    const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${API_KEY}`;
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch channel data');
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return data.items[0].id;
        }
        
        return null;
    } catch (error) {
        throw new Error('Could not find channel with that username');
    }
}

async function fetchChannelStatistics(channelId) {
    const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error('Failed to fetch channel data');n            }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        
        throw new Error('No channel found with that ID');
    } catch (error) {
        throw error;
    }
}

function displayChannelData(channelData) {
    const snippet = channelData.snippet;
    const statistics = channelData.statistics;
    
    // Update channel info
    channelTitle.textContent = snippet.title;
    channelDesc.textContent = snippet.description || 'No description available';
    channelIcon.src = snippet.thumbnails.medium.url;
    
    // Update statistics
    updateStats(statistics);
    
    // Show result container
    resultContainer.style.display = 'block';
    
    // Update last fetched time
    updateLastFetched();
}

function updateStats(statistics) {
    // Format numbers with commas
    subscriberCount.textContent = formatNumber(statistics.subscriberCount);
    viewCount.textContent = formatNumber(statistics.viewCount);
    videoCount.textContent = formatNumber(statistics.videoCount);
    
    // Calculate trend
    const currentSubs = parseInt(statistics.subscriberCount);
    
    if (previousSubscriberCount !== null) {
        const diff = currentSubs - previousSubscriberCount;
        
        if (diff > 0) {
            trend.innerHTML = `+${formatNumber(diff)} <i class="fas fa-arrow-up trend-up"></i>`;
        } else if (diff < 0) {
            trend.innerHTML = `${formatNumber(diff)} <i class="fas fa-arrow-down trend-down"></i>`;
        } else {
            trend.innerHTML = `- <i class="fas fa-minus trend-neutral"></i>`;
        }
    } else {
        trend.innerHTML = '- <i class="fas fa-minus trend-neutral"></i>';
    }
    
    // Update previous count for next comparison
    previousSubscriberCount = currentSubs;
}

function formatNumber(num) {
    return parseInt(num).toLocaleString();
}

function updateLastFetched() {
    const now = new Date();
    lastUpdated.textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

function startLiveUpdates() {
    // Clear any existing interval
    if (pollInterval) {
        clearInterval(pollInterval);
    }
    
    // Poll every 5 seconds
    pollInterval = setInterval(() => {
        fetchChannelStatistics(currentChannelId)
            .then(data => {
                updateStats(data.statistics);
                updateLastFetched();
            })
            .catch(error => {
                console.error('Failed to fetch live data:', error);
                stopLiveUpdates();
                showError('Lost connection to YouTube API. Live updates stopped.');
            });
    }, 5000);
}

function stopLiveUpdates() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    
    fetchBtn.disabled = false;
    stopBtn.disabled = true;
}

function showError(message) {
    errorMessage.textContent = message;
    errorContainer.style.display = 'block';
    resultContainer.style.display = 'none';
    
    // Hide error after 10 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 10000);
}

// Allow Enter key to submit
channelUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchChannelData();
    }
});