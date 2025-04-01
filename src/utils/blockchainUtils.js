import {promises as fs} from "fs"
import {fileURLToPath} from "url"
import {dirname, join} from "path"
import dotenv from "dotenv"
import clipboardy from "clipboardy"
import Web3 from 'web3'

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

/** General utility functions */
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

/** Class that helps with interaction with ethereum mainnet using alchemy */
class ethHandler{
    /**
     * Creates an instance of ethHandler class which helps with interaction 
     * with ethereum mainnet using alchemy.
     * @param {string} apiKey - Your Alchemy API key.
     */
    constructor(apiKey){
        this.apiKey = apiKey
        this.baseURL = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
        this.web3 = new Web3(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`)
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
     * Gets token's information using its address
     * @param {string} tokenAddress - The address of the token
     * @param {object} ERC20_ABI - The ABI of the ERC20 token
     * @returns {object} An object resembling token's address, decimals and symbol 
     */
    async getTokenInfo(tokenAddress, ERC20_ABI){
        const tokenContract = new this.web3.eth.Contract(ERC20_ABI, tokenAddress)

        const tokenSymbol = await tokenContract.methods.symbol().call()
        const tokenDecimals = await tokenContract.methods.decimals().call()

        return {
            address: tokenAddress,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
        }
    }   

    /**
     * Gets a uniswap V2's pool information
     * @param {string} poolAddress - The address of the uniswap V2 pool
     * @returns {object} An object resembling the pool's information
     */
    async getPoolInfo_UniswapV2(poolAddress){
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
            token0: token0,
            token1: token1
        }
    }


    /**
     * Gets current pool price of a uniswap pool by its reserves.
     * @param {string} poolAddress - The address of the uniswap V2 pool
     * @param {object} poolInfo - An object resembling each token's info in the pool
     *  namely, its address, symbol and decimals.
     * @returns {object} Pool's reserves and symbol for each token, and calculated price
     */
    async getPoolPrice_UniswapV2(poolAddress, poolInfo){
      // Fetch ABIs
        const UNISWAP_POOL_ABI = await loadABI(join(getDirPath(), "ABIs/uniswapV2.json"))
        const ERC20_ABI = await loadABI(join(getDirPath(), "ABIs/ERC20_Tokens.json"))

        // Create contract instance
        const poolContract = new this.web3.eth.Contract(UNISWAP_POOL_ABI, poolAddress)
        
        // Get pool reserves
        const { _reserve0, _reserve1, _blockTimestampLast } = await poolContract.methods.getReserves().call()

        // Calculate the pool price
        const divisor0 = 10n ** poolInfo.token0.decimals
        const divisor1 = 10n ** poolInfo.token1.decimals

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
    }
}

/** A class that helps with finding trading pairs */
class crawler{
    /**
     * Creates an instance of ethHandler class which helps with interaction 
     * with ethereum mainnet using alchemy.
     * @param {string} apiKey - Your Alchemy API key.
     */
    constructor(apiKey){
        this.apiKey = apiKey
        this.baseURL = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`
        this.web3 = new Web3(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`)

        // Factory addresses
        this.uniswap_v2_factory_address_ETH = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
        this.uniswap_v3_factory_address_ETH = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
        this.sushiswap_v2_factory_address_ETH = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac"
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
            const v3Pools = await getV3Pool(token0Address, token1Address)
            
            if(v2Pool){
                allPools.push({
                    exchange: "uniswap",
                    address: v2Pool,
                    type: 'V2',
                })
            }

            if(v3Pools){
                for(const pool of v3Pools){
                    allPools.push({
                        exchange: "uniswap",
                        address: pool.address,
                        type: 'V3',
                        fee: pool.fee,
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

        // Contracts
        const sushiV2Factory = new this.web3.eth.Contract(sushiswapV2Factory_ABI, this.sushiswap_v2_factory_address_ETH)

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

        try {
            // Fetch pools
            const allPools = []
            const v2Pool = await getV2Pool(token0Address, token1Address)
            
            if(v2Pool){
                allPools.push({
                    exchange: "sushiswap",
                    address: v2Pool,
                    type: 'V2',
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

// const apiKey = "Rn-7BZZPcv53BM9dDeiGNkwn3ufqDer6"
// const handler = new ethHandler(process.env.alchemy_api_key)
// const poolAddress = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc'

// const poolInfo = await handler.getPoolInfo_UniswapV2(poolAddress)
// console.log(await handler.getPoolPrice_UniswapV2(poolAddress, poolInfo))

const crawlerHandler = new crawler(process.env.alchemy_api_key)
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // Wrapped Ether
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' // Tether USD
console.log(await crawlerHandler.sushiswapCrawler_ETH(USDT, WETH))

export{
    ethHandler,
}