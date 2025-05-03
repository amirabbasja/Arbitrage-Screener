// A script that limits the number of requests per minute
import Bottleneck from "bottleneck"
import dbUtils from "./dbUtils.js"
import { el } from "date-fns/locale"

// Store all limiters in a map
const limiters = new Map()
const limiterStats = new Map()
const inFlightRequests = new Map()

// Function to create a new limiter with custom configuration
function createLimiter(name, config = {}) {

    // Merge default with provided config
    const limiterConfig = {...config }
    
    // Create the limiter
    const limiter = new Bottleneck(limiterConfig)
    
    // Initialize stats for this limiter
    const stats = {
        queued: 0,
        running: 0,
        completed: 0,
        dropped: 0,
        lastExecutionTime: null,
        averageExecutionTime: 0
    }
    
    // Set up event listeners to track stats
    limiter.on('queued', () => {
        stats.queued++
    })

    limiter.on('executing', () => {
        stats.queued--
        stats.running++
    })

    limiter.on('done', (info) => {
        stats.running--
        stats.completed++
        
        // Calculate running average
        stats.averageExecutionTime = 0
    })

    limiter.on('dropped', () => {
        stats.dropped++
    })
    
    // Store the limiter and its stats
    limiters.set(name, limiter)
    limiterStats.set(name, stats)
    
    return limiter
}

// Create the default Alchemy limiter
createLimiter('alchemy-RPC', {
    maxConcurrent: 1,
    minTime: 0,
    reservoir: 200,
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 60 * 1000,
    highWater: 200,
    strategy: Bottleneck.strategy.LEAK,
    timeout: 5000,
})

createLimiter('curve-API', {
    maxConcurrent: 1,
    minTime: 1000 / 20, // 20 requests per second
    reservoir: 200,
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 60 * 1000,
    highWater: 200,
    strategy: Bottleneck.strategy.LEAK,
    timeout: 5000,
})

// Helper function to generate a unique request key
function generateRequestKey(req) {
    // Create a unique key based on URL path, query params, and request body
    const path = req.path || req.url
    const query = JSON.stringify(req.query || {})
    const body = JSON.stringify(req.body || {})
    
    return `${path}|${query}|${body}`
}

// Updated middleware that accepts a limiter name
async function rateLimitMiddleware(handler) {
    return async (req, res, next) => {
        let limiterName
        
        // Set the limiter name according to the exchange
        const exchangeName = req.params.exchange.split("_")[0]
        if(exchangeName === "curveProtocol"){
            limiterName = "curve-API"
        }else{
            limiterName = "alchemy-RPC"
        }

        try {
            const limiter = limiters.get(limiterName)
            
            if (!limiter) {
                return res.status(500).json({ 
                    error: 'Limiter configuration error', 
                    message: `Limiter "${limiterName}" not found` 
                })
            }
            
            const stats = limiterStats.get(limiterName)
            const taskId = req.query.taskId || null
            
            // Generate a unique key for this request
            const requestKey = `${limiterName}:${generateRequestKey(req)}`
            
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
                const statsBefore = { ...stats }
                
                // Add request to in-flight map
                inFlightRequests.set(requestKey, Date.now())
                
                // Wrap the handler with Bottleneck
                await limiter.schedule(async () => {
                    try {
                        await handler(req, res, next)
                    } finally {
                        // Remove from in-flight requests when done
                        inFlightRequests.delete(requestKey)
                    }

                    // Check if stats have changed
                    if (JSON.stringify(statsBefore) !== JSON.stringify(stats)) {
                        try {
                            // Get the current task from database
                            const taskResult = await dbUtils.getEntry("tasks", { id: taskId }, req.app.locals.dbPool)
                            
                            if (taskResult) {
                                // Parse existing taskResult.extra_info or create new object
                                let extraInfo = {}
                                if(taskResult.extra_info){
                                    if(!taskResult.extra_info.limiterStats){
                                        extraInfo = {limiterStats:{}}
                                    } else {
                                        extraInfo = taskResult.extra_info
                                    }
                                }else{
                                    extraInfo = {limiterStats:{}}
                                }

                                extraInfo.limiterStats[limiterName] = { ...stats }

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
                await limiter.schedule(async () => {
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

// Get stats for all limiters or a specific one
function getLimiterStats(limiterName = null) {
    if (limiterName) {
        return limiterStats.get(limiterName) || null
    }
    
    // Return all stats
    const allStats = {}
    for (const [name, stats] of limiterStats.entries()) {
        allStats[name] = { ...stats }
    }
    return allStats
}

export { 
    rateLimitMiddleware, 
    createLimiter, 
    getLimiterStats,
    limiters
}