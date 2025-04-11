// Gets available pairs in database

import express from "express"
import databaseUtils from "../utils/dbUtils.js"
import { app } from "../app.js"

const pairsRouter = express.Router()

// Gets all pairs that are in database
pairsRouter.get("/", async (req, res) => {
    try{
        const pairs = await databaseUtils.getTableAsJson("pairs", app.locals.dbPool)
        
        res.json({
            status: "success",
            data: {
                pairs: pairs
            }
        })
    }catch(err){
        res.json({
            status: "error",
            data: {
                msg: `Couldn't get the pairs from database. Error: ${err}`
            }
        })
    }
})

export {pairsRouter}

