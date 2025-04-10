import express from "express"
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dbPool } from "./config/db.js";

const app = express()

// Middleware
app.use(express.json())
app.use(express.static(join(join(fileURLToPath(import.meta.url),"../.."), 'public')));

// Local variables
app.locals.appName = "_______"
app.locals.dbPool = dbPool
app.locals.alchemyAPIKey = process.env.alchemyAPIKey

export {app}