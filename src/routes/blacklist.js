// Handles settings routes, including blacklist management

import express from "express"
import databaseUtils from "../utils/dbUtils.js"
import { app } from "../app.js"

const settingsRouter = express.Router()

// Get all blacklisted addresses
settingsRouter.get("/blacklist", async (req, res) => {
    try {
        // Check if blacklist table exists
        const tableExists = await databaseUtils.checkTableExists("blacklist", app.locals.dbPool, "public")
        
        if (!tableExists) {
            return res.status(200).json({
                status: "success",
                data: []
            })
        }
        
        const blacklist = await databaseUtils.getTableAsJson("blacklist", app.locals.dbPool)
        
        res.status(200).json({
            status: "success",
            data: blacklist
        })
    } catch (err) {
        res.status(500).json({
            status: "error",
            data: {
                msg: `Couldn't get blacklist from database. Error: ${err}`
            }
        })
    }
})

// Add a new address to blacklist
settingsRouter.post("/blacklist/:chain/:address", async (req, res) => {
    try {
        const address = req.params.address
        const chain = req.params.chain
        
        if (!address || !chain) {
            return res.status(400).json({
                status: "error",
                data: {
                    msg: "Address and chain are required"
                }
            })
        }
        
        // Check if address already exists for this chain
        const existingEntries = await databaseUtils.getEntry("blacklist", { address, chain }, app.locals.dbPool)

        if (existingEntries !== null) {
            return res.status(400).json({
                status: "error",
                data: {
                    msg: "This address is already blacklisted for this chain"
                }
            })
        }
        
        // Add to blacklist
        await databaseUtils.addRow("blacklist", { address, chain }, app.locals.dbPool)
        
        res.status(201).json({
            status: "success",
            data: {
                msg: "Address added to blacklist"
            }
        })
    } catch (err) {
        res.status(500).json({
            status: "error",
            data: {
                msg: `Couldn't add address to blacklist. Error: ${err}`
            }
        })
    }
})

// Remove address from blacklist
settingsRouter.delete("/blacklist/:chain/:address", async (req, res) => {
    try {
        const address = req.params.address
        const chain = req.params.chain
        
        if (!address || !chain) {
            return res.status(400).json({
                status: "error",
                data: {
                    msg: "Address and chain are required"
                }
            })
        }
        
        // Delete from blacklist
        await databaseUtils.deleteEntry("blacklist", { address, chain }, app.locals.dbPool)
        
        res.status(200).json({
            status: "success",
            data: {
                msg: "Address removed from blacklist"
            }
        })
    } catch (err) {
        res.status(500).json({
            status: "error",
            data: {
                msg: `Couldn't remove address from blacklist. Error: ${err}`
            }
        })
    }
})

// Check if an address is blacklisted
settingsRouter.get("/blacklist/:chain/:address", async (req, res) => {
    try {
        const address = req.params.address
        const chain = req.params.chain
        
        if (!address || !chain) {
            return res.status(400).json({
                status: "error",
                data: {
                    msg: "Address and chain are required"
                }
            })
        }
        
        // Check if address exists in blacklist for this chain
        const existingEntry = await databaseUtils.getEntry("blacklist", { address, chain }, app.locals.dbPool)
        
        res.status(200).json({
            status: "success",
            data: {
                isBlacklisted: existingEntry !== null
            }
        })
    } catch (err) {
        res.status(500).json({
            status: "error",
            data: {
                msg: `Couldn't check blacklist status. Error: ${err}`
            }
        })
    }
})

// Settings page route
settingsRouter.get("/", (req, res) => {
    res.sendFile("settings.html", { root: "public" })
})

export { settingsRouter }