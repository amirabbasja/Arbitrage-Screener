// Includes top panel to the html page
async function includeTopMenu(){
    const response = await fetch("/top-panel.html")
    const data = await response.text()

    const menuContainer = document.createElement("div")
    menuContainer.innerHTML = data

    // Add the element to the body
    document.body.insertBefore(menuContainer, document.body.firstChild)

    // Set the active menu item
    const currentPath = window.location.pathname
    const menuItems = document.querySelectorAll(".nav-links a")

    for(let i = 0; i < menuItems.length; i++){
        // Remove the active class
        menuItems[i].classList.remove("topMenu-active")
        // Add the active class
        if((menuItems[i].getAttribute("href") === currentPath) || (currentPath === "/" && menuItems[i].getAttribute("href") === "#")){
            menuItems[i].classList.add("topMenu-active")
        }
    }

    // Check if app is running in headless mode
    const headlessMode = await fetch("/status").then(res => res.json()).then(res => res.data.headless)

    if (headlessMode) {
        // Replace session button with "Headless mode" inactive button
        const sessionBtn = document.getElementById("session-btn");
        if (sessionBtn) {
            sessionBtn.textContent = "Headless mode";
            sessionBtn.disabled = true;
            sessionBtn.classList.add("headless-mode-btn");
            sessionBtn.onclick = null; // Remove any click handlers
        }
    }else{
        // Setup user popup functionality
        setupUserPopup()
    }

    // Signal addition of top menu to the page
    document.dispatchEvent(new Event("topMenuLoaded"))
}

// Function to setup user popup functionality
function setupUserPopup() {
    const sessionBtn = document.getElementById('session-btn')
    const sessionPopup = document.getElementById('session-popup')
    
    if (sessionBtn && sessionPopup) {
        // Toggle popup when session button is clicked
        sessionBtn.addEventListener('click', function(event) {
            event.stopPropagation() // Prevent the window click event from immediately closing it
            sessionPopup.classList.toggle('show')
        })
        
        // Close popup when clicking outside
        window.addEventListener('click', function(event) {
            if (!event.target.matches('.session-btn') && !event.target.closest('.session-popup')) {
                if (sessionPopup.classList.contains('show')) {
                    sessionPopup.classList.remove('show')
                }
            }
        })
        
        // Add click handlers for popup items if needed
        const popupItems = document.querySelectorAll('.session-popup-item')
        popupItems.forEach(item => {
            if (item.id !== 'limiter-stats') { // Skip the limiter stats item
                item.addEventListener('click', function() {
                    // Handle popup item clicks
                    console.log('Clicked:', this.textContent)
                    // Close the popup after clicking an item
                    sessionPopup.classList.remove('show')
                })
            }
        })

        // Start the stats updater
        updateLimiterStats()
    }
}

/** 
 * Fetches and updates the limiter stats every 500ms
 */
function updateLimiterStats() {
    const updateStats = async () => {
        try {
            const response = await fetch('/status')
            const data = await response.json()
            
            if (data.status === 'success' && data.data.tasks) {
                // Get the first running task's stats
                const runningTask = Array.isArray(data.data.tasks) ? 
                    data.data.tasks.find(task => task.status === 'running') : 
                    data.data.tasks
                
                if (runningTask && runningTask.extra_info) {
                    let extraInfo = runningTask.extra_info
                    
                    // Calculate uptime if we have a creation time
                    let uptimeText = 'N/A';
                    if (runningTask.created_at) {
                        const creationTime = new Date(runningTask.created_at);
                        const now = new Date();
                        const uptimeMs = now - creationTime;
                        
                        // Format uptime nicely
                        uptimeText = formatUptime(uptimeMs);
                    }
                    
                    // Update task info
                    document.querySelector('#stat-task-id .stat-value').textContent = runningTask.id || 'Unknown'
                    document.querySelector('#stat-uptime .stat-value').textContent = uptimeText
                    
                    // Clear any existing message
                    const messageEl = document.querySelector('.session-popup-content .stats-message')
                    if (messageEl) messageEl.remove()
                    
                    // Get the limiters container
                    const limitersContainer = document.getElementById('limiters-container')
                    
                    // Clear previous limiter stats
                    limitersContainer.innerHTML = ''
                    
                    if(extraInfo.limiterStats){
                        // Check if there are any limiter objects in extraInfo.limiterStats
                        const limiterKeys = Object.keys(extraInfo.limiterStats) || 0

                        if (limiterKeys.length > 0) {
                            // For each limiter in extraInfo, create a section
                            limiterKeys.forEach(limiterKey => {
                                const limiterStats = extraInfo.limiterStats[limiterKey]
                                const limiterName = limiterKey.replace('LimiterStats', '')
                                
                                // Create a new limiter section
                                const limiterSection = document.createElement('div')
                                limiterSection.className = 'session-popup-item limiter-stats'
                                limiterSection.innerHTML = `
                                    <h5>${limiterName} Requests</h5>
                                    <div class="limiter-stats-content">
                                        <div class="stat-row"><span class="stat-label">Queued:</span> <span class="stat-value">${limiterStats.queued || 0}</span></div>
                                        <div class="stat-row"><span class="stat-label">Dropped:</span> <span class="stat-value">${limiterStats.dropped || 0}</span></div>
                                        <div class="stat-row"><span class="stat-label">Running:</span> <span class="stat-value">${limiterStats.running || 0}</span></div>
                                        <div class="stat-row"><span class="stat-label">Completed:</span> <span class="stat-value">${limiterStats.completed || 0}</span></div>
                                        <div class="stat-row"><span class="stat-label">Avg Time:</span> <span class="stat-value">${limiterStats.averageExecutionTime ? Math.round(limiterStats.averageExecutionTime) + 'ms' : '0ms'}</span></div>
                                    </div>
                                `
                                
                                // Add the limiter section to the container
                                limitersContainer.appendChild(limiterSection)
                            })
                        } else {
                            // No limiter stats available
                            const noLimitersMsg = document.createElement('div')
                            noLimitersMsg.className = 'stats-message'
                            noLimitersMsg.textContent = 'No limiter stats available'
                            limitersContainer.appendChild(noLimitersMsg)
                        }
                    }
                } else {
                    resetStatsDisplay('No running tasks')
                }
            } else {
                resetStatsDisplay('No running tasks')
            }
        } catch (error) {
            console.error('Error fetching limiter stats:', error)
            resetStatsDisplay('Error fetching stats')
        }
    }
    
    // Helper function to format uptime in a human-readable way
    function formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    // Helper function to reset stats display
    function resetStatsDisplay(message) {
        // Update task info
        document.querySelector('#stat-task-id .stat-value').textContent = 'None'
        document.querySelector('#stat-uptime .stat-value').textContent = '0s'
        
        // Clear limiters container
        const limitersContainer = document.getElementById('limiters-container')
        limitersContainer.innerHTML = ''
        
        if (message) {
            // Add message
            const messageEl = document.createElement('div')
            messageEl.textContent = message
            messageEl.className = 'stats-message'
            
            // Clear any existing messages
            const existingMsg = document.querySelector('.session-popup-content .stats-message')
            if (existingMsg) existingMsg.remove()
            
            // Add message to limiters container
            limitersContainer.appendChild(messageEl)
        }
    }

    // Update immediately
    updateStats()
    
    // Update every 500ms
    setInterval(updateStats, 500)
}

document.addEventListener("DOMContentLoaded", includeTopMenu)