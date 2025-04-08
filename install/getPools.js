// Gets pool addresses for pairs and adds them to a database
import dotenv from "dotenv"
import {fileURLToPath} from "url"
import {dirname, join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import databaseUtils from "../src/utils/dbUtils.js"
import {dbPool} from "../src/config/db.js"

const verbose = true

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

// List all functions of the object to get exchange-specific functions
const crawlerHandler = new crawler(process.env.alchemy_api_key)
const functions = Object.getOwnPropertyNames(
    Object.getPrototypeOf(crawlerHandler)).filter(item => typeof crawlerHandler[item] === 'function');


// TODO check the database


// Necessary pairs
const pairs = [
    ["eth", "weth", "usdt"],
    ["eth", "weth", "dai"],
    ["eth", "weth", "usdc"],
]

for(let i = 0; i < pairs.length; i++){
    const chain = pairs[i][0]
    const token0 = pairs[i][1]
    const token1 = pairs[i][2]
    
    // For Ethereum blockchain
    if(chain.toLowerCase() == "eth"){
        for(let j = 0; j < functions.length; j++){
            if(functions[j].includes("_ETH")){
                const exchangeName = functions[j].split("_")[0].replace("Crawler", "") // Get the exchange name

                const poolInfo = await crawlerHandler[functions[j]](token0, token1)

                // If errors occurred or no pools were found, the returned object should have a msg key
                if(poolInfo.msg) {
                    if (verbose) {console.log(`No pairs found for ${token0}/${token1} on ${exchangeName} on ${chain} blockchain`)}
                }else{
                    // TODO Add to DB
                }
            }
        }
    }
}
