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

    // Setup user popup functionality
    setupUserPopup()

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
                    
                    if (extraInfo.alchemyLimiterStats) {
                        const stats = extraInfo.alchemyLimiterStats
                        
                        // Make sure all rows are visible first
                        document.querySelectorAll('#limiter-stats-content .stat-row').forEach(row => {
                            row.style.display = 'flex'
                        })
                        
                        // Remove any existing message
                        const messageEl = document.querySelector('#limiter-stats-content .stats-message')
                        if (messageEl) messageEl.remove()
                        
                        // Update each specific stat row
                        document.querySelector('#stat-queued .stat-value').textContent = stats.queued || 0
                        document.querySelector('#stat-dropped .stat-value').textContent = stats.dropped || 0
                        document.querySelector('#stat-running .stat-value').textContent = stats.running || 0
                        document.querySelector('#stat-completed .stat-value').textContent = stats.completed || 0
                        document.querySelector('#stat-avg-time .stat-value').textContent = 
                            stats.averageExecutionTime ? Math.round(stats.averageExecutionTime) + 'ms' : '0ms'
                    } else {
                        resetStatsDisplay('No limiter stats available')
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
    
    // Helper function to reset stats display
    function resetStatsDisplay(message) {
        if (message) {
            // If there's an error message, show it
            const rows = document.querySelectorAll('#limiter-stats-content .stat-row')
            if (rows.length > 0) {
                // Hide all rows
                rows.forEach(row => row.style.display = 'none')
                
                // Add message
                const messageEl = document.createElement('div')
                messageEl.textContent = message
                messageEl.className = 'stats-message'
                
                const container = document.getElementById('limiter-stats-content')
                // Clear any existing messages
                const existingMsg = container.querySelector('.stats-message')
                if (existingMsg) container.removeChild(existingMsg)
                
                container.appendChild(messageEl)
            }
        } else {
            // Reset all values to 0
            document.querySelector('#stat-queued .stat-value').textContent = '0'
            document.querySelector('#stat-dropped .stat-value').textContent = '0'
            document.querySelector('#stat-running .stat-value').textContent = '0'
            document.querySelector('#stat-completed .stat-value').textContent = '0'
            document.querySelector('#stat-avg-time .stat-value').textContent = '0ms'
            
            // Show all rows - explicitly set display to flex to override any previous 'none' setting
            document.querySelectorAll('#limiter-stats-content .stat-row').forEach(row => {
                row.style.display = 'flex'
            })
            
            // Remove any message
            const messageEl = document.querySelector('#limiter-stats-content .stats-message')
            if (messageEl) messageEl.remove()
        }
    }

    // Update immediately
    updateStats()
    
    // Update every 500ms
    setInterval(updateStats, 500)
}

document.addEventListener("DOMContentLoaded", includeTopMenu)