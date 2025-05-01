// A script that limits the number of requests per minute
import Bottleneck from "bottleneck"
import dbUtils from "./dbUtils.js"

const alchemyLimiter = new Bottleneck({
    maxConcurrent: 1, // Maximum number of simultaneous requests
    minTime: 0, // The minimum time (in milliseconds) that should elapse between the start of two consecutive tasks
    reservoir: 200, // Initial number of requests allowed
    reservoirRefreshAmount: 100, // Number of requests refreshed
    reservoirRefreshInterval: 60 * 1000, // Refresh interval (1 minute in milliseconds)
    highWater: 200, // Maximum size of the queue
    strategy: Bottleneck.strategy.LEAK, // What to do when the queue reaches highWater (LEAK, OVERFLOW, BLOCK)
    timeout: 5000, // How long (in ms) a job can be pending before it's rejected
})

const alchemyLimiterStats = {
    queued: 0,
    running: 0,
    completed: 0,
    dropped: 0,
    lastExecutionTime: null,
    averageExecutionTime: 0
}

// Add a cache to track in-flight requests
const inFlightRequests = new Map()

// Set up event listeners to track stats
alchemyLimiter.on('queued', () => {
    alchemyLimiterStats.queued++
})

alchemyLimiter.on('executing', () => {
    alchemyLimiterStats.queued--
    alchemyLimiterStats.running++
})

alchemyLimiter.on('done', (info) => {
    alchemyLimiterStats.running--
    alchemyLimiterStats.completed++
    
    // Track execution time
    alchemyLimiterStats.lastExecutionTime = info.duration
    
    // Calculate running average
    alchemyLimiterStats.averageExecutionTime = 
        (alchemyLimiterStats.averageExecutionTime * (alchemyLimiterStats.completed - 1) + info.duration) / 
        alchemyLimiterStats.completed
})

alchemyLimiter.on('dropped', () => {
    alchemyLimiterStats.dropped++
})

// Helper function to generate a unique request key
function generateRequestKey(req) {
    // Create a unique key based on URL path, query params, and request body
    const path = req.path || req.url
    const query = JSON.stringify(req.query || {})
    const body = JSON.stringify(req.body || {})
    
    return `${path}|${query}|${body}`
}

async function rateLimitMiddleware(handler){
    return async (req, res, next) => {
        try {
            const taskId = req.query.taskId || null
            
            // Generate a unique key for this request
            const requestKey = generateRequestKey(req)
            
            // Check if this request is already in flight
            if (inFlightRequests.has(requestKey)) {
                return res.status(409).json({ 
                    error: 'Duplicate request detected', 
                    message: 'A similar request is already being processed' 
                })
            }
            
            // If taskId is provided, update stats in the database before and after execution
            if (taskId) {
                // Get current stats before execution
                const statsBefore = { ...alchemyLimiterStats }
                
                // Add request to in-flight map
                inFlightRequests.set(requestKey, Date.now())
                
                // Wrap the handler with Bottleneck
                await alchemyLimiter.schedule(async () => {
                    try {
                        await handler(req, res, next)
                    } finally {
                        // Remove from in-flight requests when done
                        inFlightRequests.delete(requestKey)
                    }

                    // Check if stats have changed
                    if (JSON.stringify(statsBefore) !== JSON.stringify(alchemyLimiterStats)) {
                        try {
                            // Get the current task from database
                            const taskResult = await dbUtils.getEntry("tasks", { id: taskId }, req.app.locals.dbPool)
                            
                            if (taskResult) {
                                // Parse existing extra_info or create new object
                                let extraInfo = {}
                                try {
                                    extraInfo = JSON.parse(taskResult.extra_info || '{}')
                                } catch (e) {
                                    extraInfo = {}
                                }
                                
                                // Update with latest stats
                                extraInfo.alchemyLimiterStats = { ...alchemyLimiterStats }
                                
                                // Save back to database
                                await dbUtils.updateRecords(
                                    "tasks", 
                                    req.app.locals.dbPool, 
                                    { id: taskId }, 
                                    { 
                                        extra_info: JSON.stringify(extraInfo),
                                        updated_at: new Date().toISOString()
                                    }
                                )
                            }
                        } catch (dbErr) {
                            console.error(`Failed to update task stats for taskId ${taskId}:`, dbErr)
                        }
                    }
                })
            } else {
                // Add request to in-flight map
                inFlightRequests.set(requestKey, Date.now())
                
                // Regular execution without task tracking
                await alchemyLimiter.schedule(async () => {
                    try {
                        await handler(req, res, next)
                    } finally {
                        // Remove from in-flight requests when done
                        inFlightRequests.delete(requestKey)
                    }
                })
            }
        } catch (err) {
            // Handle errors (e.g., rate limit exceeded)
            res.status(429).json({ error: `Request limiter:${err}` })
        }
    }
}

// Add a cleanup function to remove stale in-flight requests
// This prevents memory leaks if some requests never complete
setInterval(() => {
    const now = Date.now()
    const staleTimeout = 5 * 60 * 1000 // 5 minutes
    
    for (const [key, timestamp] of inFlightRequests.entries()) {
        if (now - timestamp > staleTimeout) {
            console.log(`Removing stale in-flight request: ${key}`)
            inFlightRequests.delete(key)
        }
    }
}, 60 * 1000) // Run cleanup every minute

export {rateLimitMiddleware, alchemyLimiterStats}