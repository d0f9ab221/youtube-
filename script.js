// YouTube API Configuration
// ⚠️ NOTE: Agar data fetch na ho, to check karna ki Google Cloud me "YouTube Data API v3" ENABLE hai ya nahi.
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
    // Default placeholder (Aapka channel link handle ke sath)
    channelInput.value = 'https://youtube.com/@cs_skin_tool'; 
    
    // Add event listeners
    fetchBtn.addEventListener('click', fetchChannelData);
    channelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchChannelData();
        }
    });
    
    // Initial fetch thodi der baad chalega
    setTimeout(fetchChannelData, 500);
});

// Main function to fetch channel data
async function fetchChannelData() {
    const channelIdentifier = channelInput.value.trim();
    
    if (!channelIdentifier) {
        showError('Please enter a YouTube channel URL or ID');
        return;
    }
    
    // Hide previous errors & stop previous loop
    errorContainer.style.display = 'none';
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    
    // UI Loading state
    setLoadingState(true);
    
    try {
        let channelId = null;
        
        // Check karein agar user ne poora URL daala hai ya sirf ID
        if (isValidUrl(channelIdentifier)) {
            channelId = await extractChannelIdFromUrl(channelIdentifier);
        } else if (channelIdentifier.startsWith('UC')) {
            channelId = channelIdentifier; // Agar direct UC se shuru hone wali ID hai
        } else if (channelIdentifier.startsWith('@')) {
            // Agar direct handle daala hai jaise @cs_skin_tool
            channelId = await getChannelIdFromCustomUrl(channelIdentifier);
        } else {
            // Agar normal naam likha hai
            channelId = await getChannelIdFromCustomUrl('@' + channelIdentifier);
        }
        
        if (!channelId) {
            showError('Channel ID nahi dhoond paaye. Please check details.');
            setLoadingState(false);
            return;
        }
        
        // Fetch actual channel stats
        const channelData = await getChannelData(channelId);
        
        if (!channelData) {
            showError('YouTube ne is Channel ka data nahi diya. Check your API Key.');
            setLoadingState(false);
            return;
        }
        
        // UI updates
        updateChannelInfo(channelData);
        setLoadingState(false);
        
        // Live polling start (Har 10 seconds me update karega)
        currentChannelId = channelId;
        startLivePolling(channelId);
        
    } catch (error) {
        console.error('Error fetching channel data:', error);
        showError('Failed to fetch data. API Key ya Internet check karein.');
        setLoadingState(false);
    }
}

// Get channel data from YouTube API
async function getChannelData(channelId) {
    const url = `${API_URL}channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        requestCounter++;
        if(requestCount) requestCount.textContent = requestCounter;
        
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        return null;
    } catch (error) {
        console.error('Error in getChannelData:', error);
        throw error;
    }
}

// FIX: Isme ab modern @ Handles aur /c/ dono support hote hain
async function extractChannelIdFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname;
        
        if (parsedUrl.hostname.includes('youtube.com')) {
            if (path.startsWith('/channel/')) {
                return path.split('/channel/')[1].split('?')[0];
            } else if (path.startsWith('/c/') || path.includes('/@')) {
                let cleanHandle = path.includes('/@') ? path.split('/@')[1] : path.split('/c/')[1];
                cleanHandle = cleanHandle.split('?')[0].split('/')[0];
                return await getChannelIdFromCustomUrl('@' + cleanHandle);
            }
        } else if (parsedUrl.hostname === 'youtu.be') {
            const videoId = path.split('/')[1];
            return await getChannelIdFromVideoId(videoId);
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Search channel ID using handle or custom name
async function getChannelIdFromCustomUrl(customUrl) {
    try {
        const searchUrl = `${API_URL}search?part=id&q=${encodeURIComponent(customUrl)}&type=channel&key=${API_KEY}`;
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data && data.items && data.items.length > 0) {
            return data.items[0].id.channelId;
        }
        return null;
    } catch (error) {
        console.error('Custom URL conversion error:', error);
        return null;
    }
}

// Get channel ID from video ID (for share links)
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
        return null;
    }
}

// Update UI with channel information
function updateChannelInfo(channelData) {
    const snippet = channelData.snippet;
    const statistics = channelData.statistics;
    
    if(channelTitle) channelTitle.textContent = snippet.title;
    
    let description = snippet.description || 'No description available.';
    if (description.length > 200) description = description.substring(0, 200) + '...';
    if(channelDescription) channelDescription.textContent = description;
    
    if (channelIcon) {
        if (snippet.thumbnails && snippet.thumbnails.medium) {
            channelIcon.src = snippet.thumbnails.medium.url;
        } else if (snippet.thumbnails && snippet.thumbnails.default) {
            channelIcon.src = snippet.thumbnails.default.url;
        }
    }
    
    if (snippet.publishedAt && channelJoined) {
        const date = new Date(snippet.publishedAt);
        channelJoined.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    if(channelCountry) channelCountry.textContent = snippet.country || 'N/A';
    
    // Updating Numbers
    if(subscriberCount) subscriberCount.textContent = formatNumber(statistics.subscriberCount);
    if(videoCount) videoCount.textContent = formatNumber(statistics.videoCount);
    if(viewCount) viewCount.textContent = formatNumber(statistics.viewCount);
    
    updateChangeIndicator(statistics.subscriberCount);
    showSuccessAnimation();
}

// Start live polling for subscriber count
function startLivePolling(channelId) {
    pollingInterval = setInterval(async () => {
        try {
            const channelData = await getChannelData(channelId);
            if (channelData) {
                updateChannelInfo(channelData);
                const lastUpdatedElement = document.querySelector('.last-updated');
                if (lastUpdatedElement) lastUpdatedElement.textContent = 'Updated just now';
            }
        } catch (error) {
            console.error('Error in live polling:', error);
        }
    }, 10000); // 10 seconds check
}

// Update change indicator based on subscriber history
function updateChangeIndicator(currentSubscribers) {
    subscriberHistory.push(parseInt(currentSubscribers));
    if (subscriberHistory.length > 5) subscriberHistory.shift();
    
    if (subscriberHistory.length >= 2 && subChange) {
        const last = subscriberHistory[subscriberHistory.length - 1];
        const previous = subscriberHistory[subscriberHistory.length - 2];
        const change = last - previous;
        
        if (change > 0) {
            subChange.innerHTML = `<i class="fas fa-arrow-up"></i> +${formatNumber(change)} just now`;
            subChange.style.color = 'green';
        } else if (change < 0) {
            subChange.innerHTML = `<i class="fas fa-arrow-down"></i> -${formatNumber(Math.abs(change))} just now`;
            subChange.style.color = 'red';
        } else {
            subChange.innerHTML = 'Stable';
            subChange.style.color = 'gray';
        }
    } else if (subChange) {
        subChange.innerHTML = 'Counting...';
        subChange.style.color = 'gray';
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

function showError(message) {
    if(errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        setTimeout(() => { errorContainer.style.display = 'none'; }, 5000);
    }
}

function setLoadingState(isLoading) {
    if (!fetchBtn) return;
    if (isLoading) {
        fetchBtn.innerHTML = 'Loading...';
        fetchBtn.disabled = true;
    } else {
        fetchBtn.innerHTML = 'Fetch Subscribers';
        fetchBtn.disabled = false;
    }
}

function showSuccessAnimation() {
    if(!subscriberCount) return;
    subscriberCount.style.transform = 'scale(1.05)';
    setTimeout(() => { subscriberCount.style.transform = 'scale(1)'; }, 200);
}

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}
