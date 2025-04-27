import {promises as fs} from "fs"
import {fileURLToPath} from "url"
import {dirname, join} from "path"
import dotenv from "dotenv"
import clipboardy from "clipboardy"
import Web3, { ERR_TX_GAS_MISMATCH } from 'web3'
import databaseUtils from "./dbUtils.js"
import { app } from "../app.js"
import e from "express"


/**=============================================================== */
/**================ General utility functions /**=================*/
/**=============================================================== */
/**
 * Reads a JSON file, prettifies it, and copies it to the clipboard
 * @param {string} filePath - Absolute path to the JSON file from base directory
 */
const prettifyAndCopyJson = async (filePath) => {
    try {
        // Resolve absolute path
        const absolutePath = filePath

        // Read the JSON file
        const rawData = await fs.readFile(absolutePath, 'utf8')

        // Parse the JSON to ensure it's valid
        const jsonObject = JSON.parse(rawData)

        // Convert to pretty-printed string with 2-space indentation
        const prettyJson = JSON.stringify(jsonObject, null, 4)

        // Copy to clipboard
        await clipboardy.write(prettyJson)  

        console.log(`Prettified JSON from "${filePath}" has been copied to clipboard`)
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: File not found at ${filePath}`)
        } else if (error instanceof SyntaxError) {
            console.error(`Error: Invalid JSON in ${filePath}`)
        } else {
            console.error(`Error: Failed to process ${filePath}: ${error.message}`)
        }
        throw error
    }
}

/**
 * Gets directory of the current file
 * @returns {string} - Returns the directory of the current file
 */
function getDirPath(){
    // Get the directory of the current file
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)

    return __dirname
}

/**
 * Load ABI from a JSON file using ES6+ syntax
 * 
 * @param {string} filePath - Path to the JSON file containing the ABI
 * @returns {Promise<Object>} - The loaded ABI
 * @throws {Error} - If file reading or JSON parsing fails
 */
async function loadABI(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8')
        return JSON.parse(data)
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: ABI file not found at ${filePath}`)
        } else {
            console.error(`Error: Failed to load ABI from ${filePath}: ${error.message}`)
        }
        throw error
    }
}


/**=============================================================== */
/**==================== Blockchain handlers ====================== */
/**=============================================================== */
/** Class that helps with interaction with ethereum mainnet using alchemy */
class ethHandler{
    /**
     * Creates an instance of ethHandler class which helps with interaction 
     * with ethereum mainnet using alchemy. Methods in the following class consist
     * of 3 types, general functions which don't have any pattern in their name,
     * and functions that are for interacting with DEXs, which are divided into two
     * parts. Functions that get the information of the pool which have the 
     * following name pattern: getPoolInfo_<ExchangeName>_<ExchangeVersion> and,
     * the functions that get quote of the pool which have the following format:
     * getPoolPrice_<ExchangeName>_<ExchangeVersion>
     * @param {string} apiKey - Your Alchemy API key.
     * @param {Object} dbPool - PostgreSQL connection pool (Optional)
     */
    constructor(apiKey, dbPool){
        this.apiKey = apiKey
        this.baseURL = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
        this.web3 = new Web3(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`)
        this.dbPool = dbPool
    }

    /**
     * Makes a call to a contract on ethereum blockchain using Alchemy api
     * @param {string} url - The url of the Alchemy api
     * @param {string} address - Address of the contract
     * @param {object} data - The data to send
     * @returns {Promise<string>} - The result of the call
     */
    async callContract(url, address, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [
                    {
                        to: address,
                        data: data,
                    },
                    'latest', // Query the latest block
                ],
            }),
        })
        const result = await response.json()
        if (result.error) throw new Error(result.error.message)
        return result.result
    }
    
    /**
     * Gets the current block number of ethereum blockchain. Not used the web3.js
     * here for increased generality.
     * @returns {Promise<number>}
     */
    async getBlockNumber(){
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
        }

        const response = await fetch(
            this.baseURL,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            }
        )

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.error) {
            throw new Error(data.error.message)
        }

        return parseInt(data.result, 16)
    }

    /**
     * Gets token's information using its address. If checkDB is defined, first 
     * it will check the database for the token information, if not found, will
     * make request to the RPC.
     * @param {string} tokenAddress - The address of the token. Can be undefined 
     *  if checkDB is defined.
     * @param {object} ERC20_ABI - The ABI of the ERC20 token. Can be undefined 
     *  if checkDB is defined.
     * @param {object} checkDB - An object to search information of the token.
     *  It should have the table name in "table" key, blockchain name is also 
     *  mandatory under the key "blockchain". An instance of postgreql pool should
     *  be passed under the key "pool". To search, one of the keys "symbol" or 
     *  "contract_address" should be inputted as well.
     * @returns {object} An object resembling token's address, decimals and symbol 
     */
    async getTokenInfo(tokenAddress, ERC20_ABI, checkDB){
        let _tokenAddress = undefined
        let _tokenSymbol = undefined
        let _tokenDecimals = undefined
        let tokenSymbol = undefined
        let tokenDecimals = undefined

        if (checkDB){
            if(checkDB.table === undefined){ throw new Error("Table name not defined") }
            if(checkDB.blockchain === undefined){ throw new Error("Blockchain name not defined") }
            if(checkDB.pool === undefined){ throw new Error("Database pool not defined") }
            if(checkDB.symbol === undefined && checkDB.contract_address === undefined){ throw new Error("Symbol or contract address not defined") }
            
            const condition = checkDB.symbol ? {symbol: checkDB.symbol} : {contract_address: checkDB.contract_address}
            const tokenData = await databaseUtils.getEntry(checkDB.table, condition, checkDB.pool)
            
            if(tokenData){
                _tokenAddress = tokenData.contract_address
                _tokenSymbol = tokenData.symbol
                _tokenDecimals = tokenData.decimals

                return {
                    address: _tokenAddress,
                    symbol: _tokenSymbol,
                    decimals: _tokenDecimals,
                }
            }
        }else{
            // Make the contract
            const tokenContract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress)

            tokenSymbol = await tokenContract.methods.symbol().call()
            tokenDecimals = await tokenContract.methods.decimals().call()
        }

        return {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
        }
    }

    /**
     * Gets the information about a pool from database.
     * @param {String} address - The address of the pool
     * @param {String} blockchain - The name of the blockchain
     * @param {object} dbPool - A Postgreql database pool object
     * @param {array} necessaryFields - The name of the fields that are necessary to 
     *  return, else, It will return null
     * @returns 
     */
    async getPoolInfo_offline(address, blockchain, dbPool, necessaryFields) {
        const result = await databaseUtils.getEntry("pairs", {contract_address: address, blockchain: blockchain}, dbPool)
        const objKeys = Object.keys(result)

        if(!result){
            return null
        }

        if(!necessaryFields.every(key => objKeys.includes(key))){
            return null
        }

        return result
    }

    /***************************************************
     ******************* Uniswap V2 ********************
     ***************************************************/

    /**
     * Gets a uniswap V2's pool information
     * @param {string} poolAddress - The address of the uniswap V2 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolInfo_uniswap_V2(poolAddress){
      // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/uniswapV2.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))

        // Create contract instance
        const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)

        // Get token addresses
        const token0Address = await poolContract.methods.token0().call()
        const token1Address = await poolContract.methods.token1().call()

        // Get token information
        const token0 = await this.getTokenInfo(token0Address, ERC20_ABI)
        const token1 = await this.getTokenInfo(token1Address, ERC20_ABI)

        return {
            address: poolAddress,
            token0: token0, // Symbol, contract_address, decimals
            token1: token1 // Symbol, contract_address, decimals
        }
    }

    /**
     * Gets current pool price of a uniswap pool by its reserves.
     * @param {string} poolAddress - The address of the uniswap V2 pool
     *  namely, its address, symbol and decimals.
     * @returns {object} Pool's reserves and symbol for each token, and calculated price
     */
    async getPoolPrice_uniswap_V2(poolAddress){
        // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/uniswapV2.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))
        if(this.dbPool === undefined){ throw new Error("Database pool not defined") }

        const result = await this.getPoolInfo_offline(poolAddress, "eth", this.dbPool, ["token0", "token1", "contract_address", "token0_address", "token1_address", "token1_address"])

        const token0_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token0_address,
        })

        const token1_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token1_address,
        })

        if(result && token0_Info && token1_Info){
            const poolInfo = {
                address: result.contract_address,
                token0: token0_Info,
                token1: token1_Info,
            }

            // Create contract instance
            const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)
            
            // Get pool reserves
            const { _reserve0, _reserve1, _blockTimestampLast } = await poolContract.methods.getReserves().call()
            
            // Calculate the pool price
            const divisor0 = 10n ** BigInt(poolInfo.token0.decimals)
            const divisor1 = 10n ** BigInt(poolInfo.token1.decimals)

            const reserve0 = parseFloat(String(_reserve0)) / parseFloat(String(divisor0))
            const reserve1 = parseFloat(String(_reserve1)) / parseFloat(String(divisor1))

            const poolPrice = reserve0 / reserve1

            return {
                token0: {
                    symbol: poolInfo.token0.symbol,
                    reserve: reserve0,
                },
                token1: {
                    symbol: poolInfo.token1.symbol,
                    reserve: reserve1,
                },
                price: poolPrice
            }
        }else{
            return null
        }
    }


    /***************************************************
     ******************* Uniswap V3 ********************
     ***************************************************/

    /**
     * Gets a uniswap V3's pool information
     * @param {string} poolAddress - The address of the uniswap V3 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolInfo_uniswap_V3(poolAddress){
        // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/uniswapV3Pool_ETH.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))

        // Create contract instance
        const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)

        // Get token addresses
        const token0Address = await poolContract.methods.token0().call()
        const token1Address = await poolContract.methods.token1().call()

        // Get token information
        const token0 = await this.getTokenInfo(token0Address, ERC20_ABI)
        const token1 = await this.getTokenInfo(token1Address, ERC20_ABI)

        return {
            address: poolAddress,
            token0: token0,
            token1: token1
        }
    }

    /**
     * Gets current pool price of a uniswap pool by its reserves.
     * @param {string} poolAddress - The address of the uniswap V3 pool
     *  namely, its address, symbol and decimals.
     * @returns {object} Pool's reserves and symbol for each token, and calculated price
     */
    async getPoolPrice_uniswap_V3(poolAddress){
        // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/uniswapV3Pool_ETH.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))
        if(this.dbPool === undefined){ throw new Error("Database pool not defined") }

        const result = await this.getPoolInfo_offline(poolAddress, "eth", this.dbPool, ["token0", "token1", "contract_address", "token0_address", "token1_address", "token1_address"])

        const token0_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token0_address,
        })

        const token1_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token1_address,
        })

        if(result && token0_Info && token1_Info){
            const poolInfo = {
                address: result.contract_address,
                token0: token0_Info,
                token1: token1_Info,
            }

            // Create contract instance
            const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)

            const slot0 = await poolContract.methods.slot0().call();
            const sqrtPriceX96 = slot0.sqrtPriceX96;

            // Calculate price from sqrtPriceX96
            // Formula: price = (sqrtPriceX96 / 2^96)^2
            const numerator = BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96);
            const denominator = BigInt(2) ** BigInt(192); // 2^(96*2)
    
            // Calculate raw price (token1/token0)
            const rawPrice = Number(numerator) / Number(denominator);
            
            // Adjust for decimals
            const adjustedPrice = rawPrice * (10 ** (poolInfo.token0.decimals - poolInfo.token1.decimals));
    
            return {
                token0: {
                    symbol: poolInfo.token0.symbol,
                },
                token1: {
                    symbol: poolInfo.token1.symbol,
                },
                price: adjustedPrice
            }
        }else{
            return null
        }
    }

    /*****************************************************
     ******************* Sushiswap V2 ********************
     *****************************************************/

    
    /**
     * Gets a sushiswap V2's pool information
     * @param {string} poolAddress - The address of the sushiswap V2 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolInfo_sushiswap_V2(poolAddress){
        // Fetch ABIs
        const SUSHISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/sushiswapV2Pool_ETH.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))

        // Create contract instance
        const poolContract = new this.web3.eth.Contract(SUSHISWAP_POOL_ABI, poolAddress)

        // Get token addresses
        const token0Address = await poolContract.methods.token0().call()
        const token1Address = await poolContract.methods.token1().call()

        // Get token information
        const token0 = await this.getTokenInfo(token0Address, ERC20_ABI)
        const token1 = await this.getTokenInfo(token1Address, ERC20_ABI)

        return {
            address: poolAddress,
            token0: token0,
            token1: token1
        }
    }


    /**
     * Gets a sushiswap V2's pool information
     * @param {string} poolAddress - The address of the sushiswap V2 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolPrice_sushiswap_V2(poolAddress){
        // Fetch ABIs
        const SUSHISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/sushiswapV2Pool_ETH.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))
        if(this.dbPool === undefined){ throw new Error("Database pool not defined") }

        const result = await this.getPoolInfo_offline(poolAddress, "eth", this.dbPool, ["token0", "token1", "contract_address", "token0_address", "token1_address", "token1_address"])

        const token0_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token0_address,
        })

        const token1_Info = await this.getTokenInfo(null, null, {
            table: "tokens",
            blockchain: "eth",
            pool: this.dbPool,
            contract_address: result.token1_address,
        })


        if(result && token0_Info && token1_Info){
            const poolInfo = {
                address: result.contract_address,
                token0: token0_Info,
                token1: token1_Info,
            }

            // Create contract instance
            const poolContract = new this.web3.eth.Contract(SUSHISWAP_POOL_ABI, poolAddress)
            
            // Get pool reserves
            const { _reserve0, _reserve1, _blockTimestampLast } = await poolContract.methods.getReserves().call()
            
            // Calculate the pool price
            const divisor0 = 10n ** BigInt(poolInfo.token0.decimals)
            const divisor1 = 10n ** BigInt(poolInfo.token1.decimals)

            const reserve0 = parseFloat(String(_reserve0)) / parseFloat(String(divisor0))
            const reserve1 = parseFloat(String(_reserve1)) / parseFloat(String(divisor1))

            const poolPrice = reserve0 / reserve1

            return {
                token0: {
                    symbol: poolInfo.token0.symbol,
                    reserve: reserve0,
                },
                token1: {
                    symbol: poolInfo.token1.symbol,
                    reserve: reserve1,
                },
                price: poolPrice
            }
        } else{
            return null
        }
    }


    /*****************************************************
     ******************* Sushiswap V3 ********************
     *****************************************************/
    
    /**
     * Gets a sushiswap V3's pool information
     * @param {string} poolAddress - The address of the sushiswap V3 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolInfo_sushiswap_V3(poolAddress){
        // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/sushiswapV3Pool_ETH.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))

        // Create contract instance
        const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)

        // Get token addresses
        const token0Address = await poolContract.methods.token0().call()
        const token1Address = await poolContract.methods.token1().call()

        // Get token information
        const token0 = await this.getTokenInfo(token0Address, ERC20_ABI)
        const token1 = await this.getTokenInfo(token1Address, ERC20_ABI)

        return {
            address: poolAddress,
            token0: token0,
            token1: token1
        }
    }
}

/** A class that helps with finding trading pairs */
class crawler{
    /**
     * Creates an instance of ethHandler class which helps with interaction with ethereum
     * mainnet using alchemy. 
     * IMPORTANT: All method names should have the following format: <exchangeName>Crawler_<chainName>
     *      ChainName should be either abbreviated (e.g. ETH) and in uppercase
     * @param {string} apiKey - Your Alchemy API key.
     */
    constructor(apiKey){
        this.apiKey = apiKey
        this.baseURL = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
        this.web3 = new Web3(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`)
        
        // Blockchain handlers
        this.ethHandler = new ethHandler(this.apiKey)

        // Uniswap
        this.uniswap_v2_factory_address_ETH = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        this.uniswap_v3_factory_address_ETH = "0x1F98431c8aD98523631AE4a59f267346ea31F984"

        // Sushiswap
        this.sushiswap_v2_factory_address_ETH = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"
        this.sushiswap_v3_factory_address_ETH = "0xbACEB8eC6b9355Dfc0269C18bac9d6E2Bdc29C4F"

        // Curve Protocol
        this.curveProtocol_registry_address_ETH = "0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5"
        this.curveProtocol_meta_pool_factory_address_ETH = "0xB9fC157394Af804a3578134A6585C0dc9cc990d4"
        this.curveProtocol_crypto_pools_registry_address_ETH = "0x8F942C20D02bEfc377D41445793068908E2250D0"
        this.curveProtocol_crypto_factory_address_ETH = "0xF18056Bbd320E96A48e3Fbf8bC061322531aac99"
    }


    /**
     * Gets all possible trading pairs from Uniswap V2 and V3 on ethereum mainnet
     * @param {String} token0Address - First toke's contract address
     * @param {String} token1Address - Second toke's contract address
     * @returns {array} An array of trading pool objects. If an error has occurred, returns 
     *  an object with a message key, indicating the error message. If no pools are found
     *  returns an object with msg key, indicating that no pools were found.
     */
    async uniswapCrawler_ETH(token0Address, token1Address){
        // Load ABIs
        const uniswapV2Factory_ABI = await loadABI(join(getDirPath(), "./ABIs/uniswapV2Factory_ETH.json"))
        const uniswapV3Factory_ABI = await loadABI(join(getDirPath(), "./ABIs/uniswapV3Factory_ETH.json"))

        // Contracts
        const uniV2Factory = new this.web3.eth.Contract(uniswapV2Factory_ABI, this.uniswap_v2_factory_address_ETH)
        const uniV3Factory = new this.web3.eth.Contract(uniswapV3Factory_ABI, this.uniswap_v3_factory_address_ETH)

        async function getV2Pool(token0Address, token1Address) {
            try {
                const pairAddress = await uniV2Factory.methods.getPair(token0Address, token1Address).call()
                // Check if the pair exists (not zero address)
                if (pairAddress !== '0x0000000000000000000000000000000000000000') {
                    return pairAddress
                }
                return null
            } catch (error) {
                return null
            }
        }

        async function getV3Pool(token0Address, token1Address) {
            // Uniswap V3 has multiple fee tiers: 0.05% (500), 0.3% (3000), and 1% (10000)
            const feeTiers = [500, 3000, 10000]
            const pools = []

            try {
                for (const fee of feeTiers) {
                    const poolAddress = await uniV3Factory.methods.getPool(token0Address, token1Address, fee).call()
                    
                    if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
                        pools.push({ fee, address: poolAddress })
                    }
                }

                if (pools.length === 0) {
                    return []
                }
                
                return pools
            } catch (error) {
                return null
            }
        }

        try {
            // Fetch pools
            const allPools = []
            const v2Pool  = await getV2Pool(token0Address, token1Address)
            const v3Pools = await getV3Pool(token0Address, token1Address)
            let tempInfo

            if(v2Pool){
                tempInfo = await this.ethHandler.getPoolInfo_uniswap_V2(v2Pool)
                allPools.push({
                    exchange: "uniswap",
                    address: v2Pool,
                    tokens: [tempInfo.token0.symbol, tempInfo.token1.symbol],
                    tokens_addresses: [tempInfo.token0.address, tempInfo.token1.address],
                    type: 'V2',
                    extraInfo: `-`,
                })
            }

            if(v3Pools){
                for(const pool of v3Pools){
                    tempInfo = await this.ethHandler.getPoolInfo_uniswap_V3(pool.address)
                    allPools.push({
                        exchange: "uniswap",
                        address: pool.address,
                        tokens: [tempInfo.token0.symbol, tempInfo.token1.symbol],
                        tokens_addresses: [tempInfo.token0.address, tempInfo.token1.address],
                        type: 'V3',
                        extraInfo: `fee:${pool.fee}`,
                    })
                }
            }

            if(allPools.length === 0){
                return {"msg": "No pools found"}
            }else{
                return allPools
            }

        } catch (error) {
            return {"msg": error}
        }
    }


    /**
     * Gets all possible trading pairs from Sushiswap V2 ethereum mainnet
     * @param {String} token0Address - First toke's contract address
     * @param {String} token1Address - Second toke's contract address
     * @returns {array} An array of trading pool objects. If an error has occurred, returns 
     *  an object with a message key, indicating the error message. If no pools are found
     *  returns an object with msg key, indicating that no pools were found.
     */
    async sushiswapCrawler_ETH(token0Address, token1Address){
        // Load ABIs
        const sushiswapV2Factory_ABI = await loadABI(join(getDirPath(), "./ABIs/sushiswapV2Factory_ETH.json"))
        const sushiswapV3Factory_ABI = await loadABI(join(getDirPath(), "./ABIs/sushiswapV3Factory_ETH.json"))

        // Contracts
        const sushiV2Factory = new this.web3.eth.Contract(sushiswapV2Factory_ABI, this.sushiswap_v2_factory_address_ETH)
        const sushiV3Factory = new this.web3.eth.Contract(sushiswapV3Factory_ABI, this.sushiswap_v3_factory_address_ETH)
        async function getV2Pool(token0Address, token1Address) {
            try {
                const pairAddress = await sushiV2Factory.methods.getPair(token0Address, token1Address).call()
                // Check if the pair exists (not zero address)
                if (pairAddress !== '0x0000000000000000000000000000000000000000') {
                    return pairAddress
                }
                return null
            } catch (error) {
                return null
            }
        }

        async function getV3Pool(token0Address, token1Address) {
            // Sushiswap V3 has multiple fee tiers: 0.05% (500), 0.3% (3000), and 1% (10000)
            const feeTiers = [500, 3000, 10000]
            const pools = []

            try {
                for (const fee of feeTiers) {
                    const poolAddress = await sushiV3Factory.methods.getPool(token0Address, token1Address, fee).call()
                    
                    if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
                        pools.push({ fee, address: poolAddress })
                    }
                }

                if (pools.length === 0) {
                    return []
                }
                
                return pools
            } catch (error) {
                return null
            }
        }

        try {
            // Fetch pools
            const allPools = []
            const v2Pool = await getV2Pool(token0Address, token1Address)
            const v3Pool = await getV3Pool(token0Address, token1Address)
            let tempInfo
            
            if(v2Pool){
                tempInfo = await this.ethHandler.getPoolInfo_sushiswap_V2(v2Pool)
                allPools.push({
                    exchange: "sushiswap",
                    address: v2Pool,
                    tokens: [tempInfo.token0.symbol, tempInfo.token1.symbol],
                    tokens_addresses: [tempInfo.token0.address, tempInfo.token1.address],
                    type: 'V2',
                    extraInfo: `-`,
                })
            }
            
            if(v3Pool){
                for(const pool of v3Pool){
                    tempInfo = await this.ethHandler.getPoolInfo_sushiswap_V3(pool.address)
                    allPools.push({
                        exchange: "sushiswap",
                        address: pool.address,
                        tokens: [tempInfo.token0.symbol, tempInfo.token1.symbol],
                        tokens_addresses: [tempInfo.token0.address, tempInfo.token1.address],
                        type: 'V3',
                        extraInfo: `fee:${pool.fee}`,
                    })
                }
            }

            if(allPools.length === 0){
                return {"msg": "No pools found"}
            }else{
                return allPools
            }

        } catch (error) {
            return {"msg": error}
        }
    }


    /**
     * Gets all possible trading pairs from Curve protocol ethereum mainnet. It uses
     * Curve's MetaRegistry contract
     * @param {String} token0Address - First toke's contract address
     * @param {String} token1Address - Second toke's contract address
     * @returns {array} An array of trading pool objects. If an error has occurred, returns 
     *  an object with a message key, indicating the error message. If no pools are found
     *  returns an object with msg key, indicating that no pools were found.
     */
    async curveProtocolCrawler_ETH(token0Address, token1Address){
        // Load ABIs
        const curveProtocolRegistry_ABI = await loadABI(join(getDirPath(), "./ABIs/curveprotocolRegistry_ETH.json"))
        const curveProtocolMetaPoolFactory_ABI = await loadABI(join(getDirPath(), "./ABIs/curveprotocolMetaPoolFactory_ETH.json"))
        const curveProtocolCryptoPoolsRegistry_ABI = await loadABI(join(getDirPath(), "./ABIs/curveprotocolCryptoPoolsRegistry_ETH.json"))
        const curveProtocolCryptoFactory_ABI = await loadABI(join(getDirPath(), "./ABIs/curveprotocolFactory_ETH.json"))

        // Contracts
        const curveRegistry = new this.web3.eth.Contract(curveProtocolRegistry_ABI, this.curveProtocol_registry_address_ETH)
        const curveMetaPool = new this.web3.eth.Contract(curveProtocolMetaPoolFactory_ABI, this.curveProtocol_meta_pool_factory_address_ETH)
        const cryptoPoolsRegistry = new this.web3.eth.Contract(curveProtocolCryptoPoolsRegistry_ABI, this.curveProtocol_crypto_pools_registry_address_ETH)
        const cryptoFactory = new this.web3.eth.Contract(curveProtocolCryptoFactory_ABI, this.curveProtocol_crypto_factory_address_ETH)
        const contracts = [curveRegistry, curveMetaPool, cryptoPoolsRegistry, cryptoFactory]

        async function getPools(token0Address, token1Address) {
            const pools = []
            try {
                for (let j = 0; j < contracts.length; j++) {
                    const contract = contracts[j]
                    const pairAddress = await contract.methods.find_pool_for_coins(token0Address, token1Address).call()

                    // Check if the pair exists (not zero address)
                    if (pairAddress !== '0x0000000000000000000000000000000000000000') {
                        let poolName = undefined
                        let coins = undefined
                        try{poolName = await contract.methods.get_pool_name(pairAddress).call()} catch {poolName = null}
                        try{coins = await contract.methods.get_coins(pairAddress).call()} catch {coins = null}
                        

                        pools.push(
                            {   
                                pairAddress: pairAddress, 
                                poolName: poolName || "unknown", 
                                coins: coins.map(c => c !== '0x0000000000000000000000000000000000000000' ? c : null)
                            }
                        )
                    }
                }

                return pools
            } catch (error) {
                console.log(error)
                return []
            }
        }

        try {
            // Fetch pools
            const allPools = []
            const pools = await getPools(token0Address, token1Address)
            let tempInfo
            
            for(const pool in pools){
                const {pairAddress, poolName, coins} = pools[pool]
                allPools.push({
                    exchange: "curveProtocol",
                    address: pairAddress,
                    type: poolName,
                    extraInfo: {coins:coins},
                })
            }

            if(allPools.length === 0){
                return {"msg": "No pools found"}
            }else{
                return allPools
            }

        } catch (error) {
            return {"msg": error}
        }
    }
}

// prettifyAndCopyJson(join(getDirPath(), "ABIs/uniswapV2Factory.json"))

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

const crawlerHandler = new crawler(process.env.alchemy_api_key)
const _ethHandler = new ethHandler(process.env.alchemy_api_key)
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // Wrapped Ether
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' // Tether USD
const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f"
const poolV3 = "0xC4ce8E63921b8B6cBdB8fCB6Bd64cC701Fb926f2"
const poolV2 = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"
const sushiV2Pool = "0xC40D16476380e4037e6b1A2594cAF6a6cc8Da967"
const sushiV3Pool = "0x01b94ac1abf25c132bced6918513f1822d0dc52f"

// console.log(await _ethHandler.getPoolInfo_offline("0x72c2178E082feDB13246877B5aA42ebcE1b72218", "eth", app.locals.dbPool, ["contract_address", "token0", "token1"]))
// console.log(await _ethHandler.getPoolInfo_sushiswap_V2(sushiV3Pool))
// const v = await crawlerHandler.curveProtocolCrawler_ETH(WETH, USDT)
// console.log(v[1].extraInfo)


export{
    loadABI,
    getDirPath,
    ethHandler,
    crawler
}