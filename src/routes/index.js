import express from "express"
import {fileURLToPath} from "url"
import path from "path"
const indexRouter = express.Router()

// Get the root directory of the server
const __fileName = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__fileName)

// Router for the main page
indexRouter.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../", "public/index.html"))
})

export {indexRouter}