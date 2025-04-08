import express from "express"
import {ethHandler} from "../utils/blockchainUtils.js"

const quotesRouter = express.Router()

// Define the handlers
const handler_ETH = new ethHandler(process.env.alchemy_api_key)

quotesRouter.get("/:chain/:exchange/:address", async (req, res) => {
    const address = req.params.address 
    const chain = req.params.chain
    const exchange = req.params.exchange

    try{
        // TODO: Add a section that checks if exchange name is valid

        let quote, poolInfo
        if(req.params.exchange === "uniswapV2") {
            poolInfo = await handler_ETH.getPoolInfo_UniswapV2(address)
            quote = await handler_ETH.getPoolPrice_UniswapV2(address, poolInfo)
        }

        res.json({
            status: "success",
            data: {
                quote: quote,
                pool_address: address,
                exchange: exchange,
            }
        })
    } catch(err){
        res.json({
            status: "error",
            data: {
                msg: `Couldn't get the quote. Error: ${err}`
            }
        })
    }
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