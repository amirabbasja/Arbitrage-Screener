// Router for the help button on top-menu
import express from "express"
import {fileURLToPath} from "url"
import {dirname, join} from "path"
import {marked} from "marked"
import fs from "fs"
import { app } from "../app.js"
import e from "express"

const helpRouter = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

helpRouter.get("/", (req, res) => {
    res.sendFile(join(__dirname, "../../public", "help.html"))
})

helpRouter.get("/readMD", (req, res) => {
    fs.readFile(join(__dirname, "../../", "README.md"), "utf8", (err, data) => {
        if(err){
            return res.status(404).send("Couldn't find the README.md file in root directory")
        } else {
            return res.send(marked.parse(data))
        }
    })
    
})

export {helpRouter}