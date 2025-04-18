// Gets pool addresses for pairs and adds them to a database
import dotenv from "dotenv"
import {join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import databaseUtils from "../src/utils/dbUtils.js"
import {dbPool} from "../src/config/db.js"
import {ethHandler, loadABI} from "../src/utils/blockchainUtils.js"

let verbose = true

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

// List all functions of the object to get exchange-specific functions
const crawlerHandler = new crawler(process.env.alchemy_api_key)
const functions = Object.getOwnPropertyNames(
    Object.getPrototypeOf(crawlerHandler)).filter(item => typeof crawlerHandler[item] === 'function');

// Necessary pairs and token contract addresses. Except for contract address, all should be lowercase
const tokenContractAddresses = {
    "eth":{
        "weth": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "usdt": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "dai": "0x6b175474e89094c44da98b954eedeac495271d0f",
        "usdc": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    }
}

const pairs = [
    ["eth", "weth", "usdt"],
    ["eth", "weth", "dai"],
    ["eth", "weth", "usdc"],
]

// Fill up tokens table

// Define the handlers
const handler_ETH = {
    "eth" : new ethHandler(process.env.alchemy_api_key)
}

for (const network in tokenContractAddresses) {
    // Iterate through each token in the current network
    for (let token in tokenContractAddresses[network]) {
        token = await handler_ETH[network].getTokenInfo(
            tokenContractAddresses[network][token],
            await loadABI(join(getDirPath(), "..", "utils/ABIs/ERC20_Tokens.json")), undefined
        )
        
        await databaseUtils.addRow("tokens", {
            symbol: token.symbol.toLowerCase(),
            blockchain: network,
            contract_address: token.address,
            decimals: token.decimals
        }, dbPool)
    }
}

// Fill up pairs table
for(let i = 0; i < pairs.length; i++){
    const chain = pairs[i][0]
    const token0 = pairs[i][1]
    const token1 = pairs[i][2]
    const token0Address = tokenContractAddresses[chain][token0]
    const token1Address = tokenContractAddresses[chain][token1]

    if(token0Address && token1Address){
        // For Ethereum blockchain
        if(chain.toLowerCase() == "eth"){
            for(let j = 0; j < functions.length; j++){
                if(functions[j].includes("_ETH")){
                    const exchangeName = functions[j].split("_")[0].replace("Crawler", "") // Get the exchange name

                    const poolInfo = await crawlerHandler[functions[j]](token0Address, token1Address)

                    // If errors occurred or no pools were found, the returned object should have a msg key
                    if(poolInfo.msg) {
                        if (verbose) {console.log(`No pairs found for ${token0}/${token1} on ${exchangeName} on ${chain} blockchain`)}
                    }else{
                        const condition1 = await databaseUtils.getEntry("pairs", {
                            token0:token0,
                            token1:token1,
                            blockchain:chain,
                            exchange:exchangeName,
                        }, dbPool)

                        const condition2 = await databaseUtils.getEntry("pairs", {
                            token0:token1,
                            token1:token0,
                            blockchain:chain,
                            exchange:exchangeName,
                        }, dbPool)

                        if (!(condition1 || condition2)){
                            for(let k = 0; k < poolInfo.length; k++){
                                const result = await databaseUtils.addRow("pairs", {
                                    token0:token0,
                                    token1:token1,
                                    blockchain:chain,
                                    exchange:exchangeName,
                                    exchange_type:poolInfo[k].type,
                                    contract_address:poolInfo[k].address,
                                    extra_info:poolInfo[k].extraInfo
                                }, dbPool)

                                if(result && verbose) {console.log(`Added ${token0}/${token1} on ${exchangeName} on ${chain} blockchain`)}
                            }
                        } else {
                            if (verbose) {console.log(`Pair ${token0}/${token1} on ${exchangeName} on ${chain} blockchain already exists`)}
                        }
                    }
                }
            }
        }
    } else {
        if (verbose) {console.log(`${token0} or ${token1} contract address not provided`)}
    }
}