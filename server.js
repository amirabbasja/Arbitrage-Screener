// Sets up the server by connecting to the database by 
// taking the configuration files and setting up teh express app

// Import necessary modules
import express from "express"
import dotenv from "dotenv"
import { fileURLToPath } from 'url'
import path from 'path'
import {app} from "./src/app.js"
import databaseUtils from "./src/utils/dbUtils.js"
import { Server as WS_Server} from "socket.io"
import http from "http"
import { logStats } from "./src/utils/logStats.js"

// Import routers
import {indexRouter} from "./src/routes/index.js"
import { quotesRouter } from "./src/routes/quote.js"
import { pairsRouter } from "./src/routes/pairs.js"
import { helpRouter } from "./src/routes/help.js"
import { requestStatusRouter } from "./src/routes/stats.js"
import { settingsRouter } from "./src/routes/blacklist.js"

// Cleanup running tasks in the database
if(await  databaseUtils.checkTableExists("tasks", app.locals.dbPool, "public")){
    // Only cleanup if there are any records in teh database
    if (await databaseUtils.getTableAsJson("tasks", app.locals.dbPool).then(res => res.length > 0)) {
        try{
            await databaseUtils.updateRecords("tasks", app.locals.dbPool, {status:"running"}, {status:"failed", updated_at: (new Date).toISOString()})
        }catch(err){
            throw new Error(`Error during cleanup of tasks table. Error: ${err}`)
        }
    }
} else  {
    throw new Error(`Tasks table doesn't exist. Run the install directory scripts first.`)
}

// Get the arguments
let headless, runFetcher
const args = process.argv.slice(2)

if( args.length == 0) {
    headless = false
    app.locals.headless = headless
    runFetcher = false
} else if (args.length == 1){
    headless = args[0] == "headless" ? true : false
    app.locals.headless = headless
    runFetcher = false
} else if (args.length == 2){
    headless = args[0] == "headless" ? true : false
    app.locals.headless = headless
    runFetcher = args[1] == "run-fetcher" ? true : false
}

// Load .env files
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, './.env') })

// Make the websocket server to listen to the quote changes
const server = http.createServer(app)
const io = new WS_Server(server)

// Delete the previously acquired price data from table pairs
if(await databaseUtils.checkTableExists("pairs", app.locals.dbPool, "public")){
    try {
        // Reset latest_quote for all 
        const resetQuoteValue = JSON.stringify({price: "NAN", timestamp: "NAN"})
        await databaseUtils.updateRecords("pairs", app.locals.dbPool, {}, {latest_quote: resetQuoteValue})
    } catch(err) {
        console.error(`Error resetting latest_quote values: ${err.message}`)
    }
}

if(!headless){
    // Listen for PostgreSQL notifications to update the UI
    const eventListenerClient = await app.locals.dbPool.connect()
    await eventListenerClient.query('LISTEN table_change')

    eventListenerClient.on('error', (err) => {
        console.error('Event listener client error:', err.message)
    })

    eventListenerClient.on('notification', (msg) => {
        try {
            const payload = JSON.parse(msg.payload)
            io.emit('table_update', payload) // Broadcast to all connected clients
        } catch (error) {
            console.error("Error parsing or emitting payload to clients:", error)
            console.error("Raw payload was:", msg.payload)
        }
    })
}
// Middleware
app.use(express.json())

// Use the routes
app.use("/", indexRouter)
app.use("/quote", quotesRouter)
app.use("/pairs", pairsRouter)
app.use("/help", helpRouter)
app.use("/status", requestStatusRouter)
app.use("/settings", settingsRouter)

// Server setup
const port = process.env.port || 3000

// Start the server
server.listen(port, () => {
    if(headless) {
        console.log(`Headless Server is listening on port ${port}...`)
        logStats(500)
    }else {
        console.log(`Server is listening on port ${port}...`)
    }
})