// A script that is tasked with fetching quotes from exchanges in a recurrent basis.
import { ConnectionCloseError } from "web3";
import {app} from "./app.js"
import databaseUtils from "./utils/dbUtils.js"

/**
 * Batches objects in an array based on a specified property
 * @param {Array} array - The array of objects to batch
 * @param {string} property - The property to batch by
 * @returns {Object} - An object with keys as property values and values as arrays of matching objects
 */
function batchByProperty(array, property) {
    return array.reduce((batches, item) => {
        const key = item[property];

        // If this key doesn't exist in our batches yet, create a new array
        if (!batches[key]) {
            batches[key] = [];
        }

        // Add the current item to the appropriate batch
        batches[key].push(item);

        return batches;
    }, {});
}

/**
 * 
 * @param {Array} delays - An array representing delay of each function
 * @param {Array} tasks - An array representing the functions to run
 */
function setupLoops(delays, tasks) {
    // Ensure each function has a delay
    if (delays.length !== tasks.length) {
        throw new Error("Number of delays and tasks must be equal.");
    }

    // Set up an interval for each loop
    delays.forEach((delay, index) => {
        setInterval(tasks[index], delay);
    });
}

/**
 * 
 * @param {Object} pairs - An object representing the pools to fetch. Each
 *  object should have following keys: {blockchain, token0, token1, exchange
 *  exchange_type, contract_address}. Preferably, the pools should be in the
 *  same blockchain.
 */
async function requestSender(pairs){
    const urls = pairs.map((pair) => {
        return `http://${process.env.app_host}:${process.env.app_port}/quote/${pair.blockchain}/${pair.exchange}_${pair.exchange_type}/${pair.contract_address}/`
    })

    const requests = urls.map((url) => {
        return fetch(url).then(async (res) => {
            // Update the database with the fetched quote
            let response = (await res.json())

            if (response.status === "success") {
                const result = await databaseUtils.updateRecords("pairs", app.locals.dbPool, 
                    {
                        blockchain: response.data.chain,
                        exchange: response.data.exchangeName,
                        exchange_type: response.data.exchangeVersion,
                        contract_address: response.data.pool_address,
                    },
                    {
                        latest_quote: {price: response.data.quote.price, timestamp: Date.now()}
                    }
                )
            }else{
                const result = await databaseUtils.updateRecords("pairs", app.locals.dbPool, 
                    {
                        blockchain: response.data.params.chain,
                        exchange: response.data.params.exchangeName,
                        exchange_type: response.data.params.exchangeVersion,
                        contract_address: response.data.params.pool_address,
                    },
                    {
                        latest_quote: {price: "NAN", timestamp: Date.now()}
                    }
                )
            }
        })
    })

    const results = await Promise.allSettled(requests)
    
    return results
}

async function printMessage() {
    try{
        // Get all pairs that need to be fetched
        let pairs = await databaseUtils.getTableAsJson("pairs", app.locals.dbPool)
        pairs = batchByProperty(pairs, "blockchain")
        const a = requestSender(pairs["eth"])
        console.log("aaaa")




        // const _host = process.env.app_host
        // const _port = process.env.app_port
        // let url1 = `http://${_host}:${_port}/quote/eth/uniswap_V2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc/`
        // let url2 = `http://${_host}:${_port}/quote/eth/uniswap_V2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc/`
        // let url3 = `http://${_host}:${_port}/quote/eth/uniswap_V2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc/`
        // let url4 = `http://${_host}:${_port}/quote/eth/uniswap_V2/0xB4e16d0168e52d35CaCD2185b44281Ec28C9Dc/`
        // let urlS = [
        //     url1, url2, url3, url4, //url1, url2, url3, url4, url1, url2, url3, url4, url1, url2, url3, url4,
        //     //url1, url2, url3, url4, url1, url2, url3, url4, url1, url2, url3, url4, url1, url2, url3, url4
        // ]

        // const requestTimes = [];
        // const requestStart = Date.now();
        // const requests = urlS.map((url, index) => 
        //     {
        //         return fetch(url)
        //             .then(response => {
        //                     const requestEnd = Date.now();
        //                     requestTimes[index] = {
        //                     url,
        //                     duration: requestEnd - requestStart,
        //                     timestamp: new Date(requestEnd).toISOString()
        //                 }
        //                 return response;
        //             })
        //             .catch(error => {
        //                 const requestEnd = Date.now();
        //                 requestTimes[index] = {
        //                     url,
        //                     error: error.message,
        //                     duration: requestEnd - requestStart,
        //                     timestamp: new Date(requestEnd).toISOString()
        //                 }
        //                 throw error;
        //             })
        //     }
        // )
        
        // const startTime = Date.now()
        // let results = await Promise.allSettled(requests)
        // let response = undefined
        // // Calculate total time
        // const totalTime = Date.now() - startTime;

        // for (let i = 0; i < results.length; i++) {
        //     // The issue is here - Promise.allSettled returns objects with status and value/reason properties
        //     if (results[i].status === 'fulfilled') {
        //         response = await results[i].value.json()
                
        //         if(response.status === "success"){
        //             console.log(response.data.exchange, response.data.quote.price, `${requestTimes[i].duration}ms`)
        //         }else{
        //             console.log("NAN", "NAN", `${requestTimes[i].duration}ms`, `${response.data.params.exchangeName}_${response.data.params.exchangeVersion}`)
        //         }
        //     } else {
        //         console.log(`Request ${i} failed:`, results[i].reason)
        //     }
        // }
        
        setTimeout(printMessage, 5000)
    }catch(err){
        console.log(err)
    }
}

printMessage()