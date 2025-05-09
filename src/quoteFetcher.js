// A script that is tasked with fetching quotes from exchanges in a recurrent basis.
import { ConnectionCloseError } from "web3";
import {app} from "./app.js"
import databaseUtils from "./utils/dbUtils.js"
import { start } from "repl";

// Get the task ID from command line arguments
const taskId = process.argv[2];

if (!taskId) {
    console.error("Task ID is required");
    process.exit(1);
}

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
 * Sets up intervals for each loop
 * @param {Array} delays - An array representing delay of each function (In ms)
 * @param {Array} tasks - An array representing the functions to run
 * @param {string} taskId - The ID of the current task
 */
async function setupLoops(delays, tasks, taskId) {
    // Ensure each function has a delay
    if (delays.length !== tasks.length) {
        throw new Error("Number of delays and tasks must be equal.");
    }

    // Set up an interval for each loop
    const intervals = delays.map((delay, index) => {
        return setInterval(() => tasks[index](taskId), delay);
    });

    // Return intervals so they can be cleared if needed
    return intervals;
}

/**
 * A function that sends requests to fetch quotes
 * @param {Object} pairs - An object representing the pools to fetch
 * @param {string} taskId - The ID of the current task
 */
async function requestSender(pairs, taskId){
    try {
        const urls = pairs.map((pair) => {
            return `http://${process.env.app_host}:${process.env.app_port}/quote/${pair.blockchain}/${pair.exchange}_${pair.exchange_type}/${pair.contract_address}?taskId=${taskId}`
        })

        const requests = urls.map((url) => {
            return fetch(url)
                .then(async (res) => {
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
                                latest_quote: {price: "ERR", timestamp: Date.now()}
                            }
                        )
                    }
                })
                .catch(err => {
                    console.error(`QuoteFetcher: Request failed for ${url}:`, err);
                    return null; // Prevent unhandled rejections
                });
        });

        const results = await Promise.allSettled(requests);
        return results.filter(result => result !== null);
    } catch (err) {
        console.error('Error in requestSender:', err);
        return [];
    }
}

/**
 * Fetches quotes for all pairs
 * @param {string} taskId - The ID of the current task
 */
async function fetchQuotes(taskId) {
    try{
        // Get all pairs that need to be fetched
        let pairs = await databaseUtils.getTableAsJson("pairs", app.locals.dbPool)

        let filteredPairs = await Promise.all(
            pairs.map(async (pair) => {
                const isBlacklisted = await databaseUtils.getEntry("blacklist", { address: pair.contract_address, chain: pair.blockchain }, app.locals.dbPool)

                if(isBlacklisted){
                    return null
                }else{
                    return pair
                }
            })
        ).then((results) => {
            return results.filter(pair => pair !== null)
        })

        filteredPairs = batchByProperty(filteredPairs, "blockchain")

        // Set up a different loop for each blockchain
        const ethCatcher = (taskId) => requestSender(filteredPairs["eth"], taskId)

        // Run the loops
        const intervals = await setupLoops([10000], [ethCatcher], taskId)
        
        // Set up event listener for process termination
        process.on('SIGTERM', () => {
            console.log(`Task ${taskId} received SIGTERM signal`);
            // Clear all intervals
            intervals.forEach(interval => clearInterval(interval));
            process.exit(0);
        });

    }catch(err){
        console.log(`Error fetching quotes: ${err}`)
        process.exit(1);
    }
}

// Start the fetching process with the task ID
fetchQuotes(taskId);