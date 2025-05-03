// Gets the status of the limiters that are in charge of handling the outgoing requests

import express from "express"
import databaseUtils from "../utils/dbUtils.js"
import { app } from "../app.js"

const requestStatusRouter = express.Router()

requestStatusRouter.get("/", async (req, res) => {
    try{
        const runningTasks = await databaseUtils.getEntry("tasks", {status:"running"}, app.locals.dbPool)
        res.status(200).json({
            status: "success",
            data: {
                tasks: runningTasks
            }
        })
    } catch(err){
        res.status(500).json({
            status: "error",
            data: {
                msg: `Couldn't get the tasks from database. Error: ${err}`
            }
        })
    }
})

export {requestStatusRouter}