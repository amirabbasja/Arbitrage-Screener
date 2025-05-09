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

        // Add database pool details
        response.data.databasePoolStatistics = {
            totalCount: app.locals.dbPool.totalCount,
            idleCount: app.locals.dbPool.idleCount,
            waitingCount: app.locals.dbPool.waitingCount
        }

        // response.data.memoryStats = await databaseUtils.getPgMemoryStats(app.locals.dbPool)

        // Add the running tasks
        const runningTasks = await databaseUtils.getEntry("tasks", {status:"running"}, app.locals.dbPool, {maxEntries: 100})

        if(runningTasks){     
            response.data.tasks = []
            if(runningTasks.length !== 0){
                for(let i  = 0; i < runningTasks.length; i++){
                    response.data.tasks.push(runningTasks[i])
                }
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