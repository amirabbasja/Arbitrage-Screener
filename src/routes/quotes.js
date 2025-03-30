import express from "express"
import {ethHandler} from "../utils/blockchainUtils.js"

const quotesRouter = express.Router()

// Define the handlers
const handler_ETH = new ethHandler(process.env.alchemy_api_key)

quotesRouter.get("/", (req, res) => {
    const address = req.params.address 
    try{
        const ethHandler = new blockchainUtils.ethHandler
        const quote = blockchainUtils.ethHandler.getPoolInfo_UniswapV2(address)
    } catch(err){
        
    }
    res.send("User get method")
})

// quotesRouter.post("/", (req, res) => {
//     res.send("User post method")
// })

// quotesRouter.put("/", (req, res) => {
//     res.send("User put method")
// })

// quotesRouter.delete("/", (req, res) => {
//     res.send("User delete method")
// })

export {quotesRouter}