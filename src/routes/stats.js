// Gets the status of the limiters that are in charge of handling the outgoing requests

import express from "express"
import databaseUtils from "../utils/dbUtils.js"
import { app } from "../app.js"

const requestStatusRouter = express.Router()

requestStatusRouter.get("/", async (req, res) => {
    try{
        // make the response object
        const response = {
            status: "success",
            data: {}
        }

        // Add the application overall params
        response.data.headless = app.locals.headless // If the app is running in headless mode (No UI updates)

        // Add the running tasks
        const runningTasks = await databaseUtils.getEntry("tasks", {status:"running"}, app.locals.dbPool)
        if(runningTasks){        
                if(runningTasks.length !== 0){
                response.data.tasks = runningTasks
            }
        }

        // Send response
        res.status(200).json(response)
    } catch(err){
        res.status(500).json({
            status: "error",
            data: {
                msg: `Faced errors getting app status. Error: ${err}`
            }
        })
    }
})

export {requestStatusRouter}