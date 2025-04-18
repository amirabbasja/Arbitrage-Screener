// A file that limits the number of requests per minute
import Bottleneck from "bottleneck"

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

async function rateLimitMiddleware(handler){
    return async (req, res, next) => {
        try {
            // Wrap the handler with Bottleneck
            await alchemyLimiter.schedule(() => handler(req, res, next));
        } catch (err) {
            // Handle errors (e.g., rate limit exceeded)
            res.status(429).json({ error: 'Too Many Requests' });
        }
    };
};

export {rateLimitMiddleware}