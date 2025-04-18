// Gets quotes for each asset
import { fileURLToPath } from 'url';
import path from 'path';
import express from "express"
import {ethHandler} from "../utils/blockchainUtils.js"
import {app} from "../app.js"
import databaseUtils from "../utils/dbUtils.js"
import { spawn } from "child_process"
import { rateLimitMiddleware } from "../utils/requestLimiter.js"
import dbUtils from '../utils/dbUtils.js';

const quotesRouter = express.Router()

// Define the handlers
const handler_ETH = new ethHandler(process.env.alchemy_api_key)

quotesRouter.get("/:chain/:exchange/:address", 
    await rateLimitMiddleware(
        async (req, res) => {
            const address = req.params.address 
            const chain = req.params.chain
            const exchangeName = req.params.exchange.split("_")[0]
            const exchangeVersion = req.params.exchange.split("_")[1]
            

            try{
                // TODO: Add a section that checks if exchange name is valid

                const pair = await databaseUtils.getEntry("pairs", {
                    blockchain:chain,
                    contract_address:address
                }, app.locals.dbPool)

                let quote, poolInfo
                
                // If couldn't find the pair in the database, get the pool info from the blockchain
                if(!pair) {
                    poolInfo = await handler_ETH.getPoolInfo_UniswapV2(address)
                } else {
                    const token0 = await dbUtils.getEntry("tokens", {
                        blockchain:chain, symbol:pair.token0
                    }, app.locals.dbPool)
                
                    const token1 = await dbUtils.getEntry("tokens", {
                        blockchain:chain, symbol:pair.token1
                    }, app.locals.dbPool)

                    if(`${exchangeName}_${exchangeVersion}` === "uniswap_V2") {
                        poolInfo = {
                            address: pair.pool_address,
                            token0: {
                                address: token0.contract_address,
                                symbol: token0.symbol,
                                decimals: token0.decimals,
                            },
                            token1: {
                                address: token1.contract_address,
                                symbol: token1.symbol,
                                decimals: token1.decimals,
                            },
                        }
                    }
                }

                quote = await handler_ETH.getPoolPrice_UniswapV2(address, poolInfo)
                
                res.json({
                    status: "success",
                    data: {
                        quote: quote,
                        chain: chain,
                        pool_address: address,
                        exchangeName: exchangeName,
                        exchangeVersion: exchangeVersion
                    }
                })
            } catch(err){
                res.status(500).json({
                    status: "error",
                    data: {
                        msg: `Couldn't get the quote. Error: ${err}`,
                        params: {
                            chain: chain,
                            pool_address: address,
                            exchangeName: exchangeName,
                            exchangeVersion: exchangeVersion
                        }
                    }
                })
            }
        }
    )
)

// Start the quoteFetcher script as a new task
quotesRouter.post("/quoteFetcher", async (req, res) => {
    try{
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Spawn a child process to run the script
        const childProcess = spawn("node", [path.join(__dirname, "..", "quoteFetcher.js")])
        const pid = childProcess.pid
        
        //Insert the task to the database
        const query = await databaseUtils.addRow("tasks", {
            status: "running",
            pid: pid,
            created_at: (new Date).toISOString(),
            updated_at: (new Date).toISOString()
        }, app.locals.dbPool)

        const taskId = query.id

        // Forward child process stdout to parent console (For debugging purposes)
        childProcess.stdout.on('data', (data) => {
            console.log(`Task ${taskId} stdout: ${data}`);
        });

        // Forward child process stderr to parent console (For debugging purposes)
        childProcess.stderr.on('data', (data) => {
            console.error(`Task ${taskId} stderr: ${data}`);
        });

        // Wait for the child process to exit
        childProcess.on("exit", async (code, signal) => {
            let status = "completed"
            if (code !== 0) status = 'failed'; // Non-zero exit code indicates failure
            else if (signal) status = 'terminated'; // Terminated by a signal
            try {
                await databaseUtils.updateRecords("tasks", app.locals.dbPool, {id:taskId}, {status:status, updated_at:(new Date).toISOString()})
            } catch (error) {
                console.error('Error updating task status:', error);
            }
        })

        res.json({
            status: "success",
            data: {
                taskId: taskId
            }
        })
    }catch(err){
        res.json({
            status: "error",
            data: {
                msg: `Couldn't start the quote fetcher. Error: ${err}`
            }
        })
    }
})

// Get all tasks
quotesRouter.get("/quoteFetcher", async (req, res) => {
    try{
        const tasks = await databaseUtils.getTableAsJson("tasks", app.locals.dbPool)
        res.json({
            status: "success",
            data: {
                tasks: tasks
            }
        })
    } catch(err){
        res.json({
            status: "error",
            data: {
                msg: `Couldn't get the tasks from database. Error: ${err}`
            }
        })
    }
})

// Terminate a specific task
quotesRouter.delete("/quoteFetcher/:taskId", async (req, res) => {
    const taskId = req.params.taskId
    try{
        const queryResult = await databaseUtils.getEntry("tasks", {id:taskId}, app.locals.dbPool)
        
        if (queryResult.length === 0) {
            return res.json({
                status: "error",
                data: {
                    msg: `Couldn't find the task with id ${taskId}`
                }
            })
        }

        const pid = queryResult.pid
        const _now = (new Date).toISOString()

        try{
            process.kill(pid, "SIGTERM")
            databaseUtils.updateRecords("tasks", app.locals.dbPool, {id:taskId}, {status:"terminated", updated_at: _now})
            res.json({
                status: "success",
                data: {
                    taskId: taskId
                }
            })
        } catch (err){
            if(err.code === "ESRCH"){
                databaseUtils.updateRecords("tasks", app.locals.dbPool, {id:taskId}, {status:"terminated", updated_at: _now})
                res.json({
                    status: "success",
                    data: {
                        taskId: taskId
                    }
                })
            }else{
                res.json({
                    status: "error",
                    data: {
                        msg: `Couldn't terminate the task. Error: ${err}`
                    }
                })
            }
        }
    } catch (err){
        res.json({
            status: "error",
            data: {
                msg: `Couldn't terminate the task. Error: ${err}`
            }
        })
    }
})

export {quotesRouter}