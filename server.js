// Sets up the server by connecting to the database by 
// taking the configuration files and setting up teh express app

// Import necessary modules
import express from "express"
import dotenv from "dotenv"
import { fileURLToPath } from 'url';
import path from 'path';
import {app} from "./src/app.js"

// Import routers
import {indexRouter} from "./src/routes/index.js"
import { userRouter } from "./src/routes/user.js";

// Load .env files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, './.env') })

// Middleware
app.use(express.json())

// Use the routes
app.use("/", indexRouter)
app.use("/user", userRouter)

// Server setup
const port = process.env.port || 3000

app.listen(port, () => {
    console.log(`Server is listening on port ${port}...`)
})
