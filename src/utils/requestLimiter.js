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

async function rateLimitMiddleware(handler){
    return async (req, res, next) => {
        try {
            const taskId = req.query.taskId || null;
            
            // If taskId is provided, update stats in the database before and after execution
            if (taskId) {
                // Get current stats before execution
                const statsBefore = { ...alchemyLimiterStats };
                
                // Wrap the handler with Bottleneck
                await alchemyLimiter.schedule(async () => {
                    await handler(req, res, next);

                    // Check if stats have changed
                    if (JSON.stringify(statsBefore) !== JSON.stringify(alchemyLimiterStats)) {
                        try {
                            // Get the current task from database
                            const taskResult = await dbUtils.getEntry("tasks", { id: taskId }, req.app.locals.dbPool);
                            
                            if (taskResult) {
                                // Parse existing extra_info or create new object
                                let extraInfo = {};
                                try {
                                    extraInfo = JSON.parse(taskResult.extra_info || '{}');
                                } catch (e) {
                                    extraInfo = {};
                                }
                                
                                // Update with latest stats
                                extraInfo.alchemyLimiterStats = { ...alchemyLimiterStats };
                                
                                // Save back to database
                                await dbUtils.updateRecords(
                                    "tasks", 
                                    req.app.locals.dbPool, 
                                    { id: taskId }, 
                                    { 
                                        extra_info: JSON.stringify(extraInfo),
                                        updated_at: new Date().toISOString()
                                    }
                                );
                            }
                        } catch (dbErr) {
                            console.error(`Failed to update task stats for taskId ${taskId}:`, dbErr);
                        }
                    }
                });
            } else {
                // Regular execution without task tracking
                await alchemyLimiter.schedule(() => handler(req, res, next));
            }
        } catch (err) {
            // Handle errors (e.g., rate limit exceeded)
            res.status(429).json({ error: 'Request limiter:Too Many Requests' });
        }
    }
}

export {rateLimitMiddleware, alchemyLimiterStats}