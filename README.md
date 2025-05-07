# A screener for finding arbitrage opportunities on DEXs or CEXs

## Dependencies

0. Install PostgerSQL and timescaleDB to your operating system. Make sure you **RESTART** Postgresql after installing timescaleDB.

1. Install *nodemon* for development

2. Install *marked* for compiling markdown language in help page

3. Install *pg*. The database uses PostgerSQL using *pg* package

4. Install *express* for web development

5. Install *web3* package for interacting with EVM blockchains

6. Install *dotenv* package for loading the env file

7. Install *bottleneck* package for limiting the request rate to RPCs

8. Install *socket.io* package for real-time updates UI via websockets

9. install *date-fns* package to convert UTC time to local time.

---

## How to work with this app

* Populate the **.env** file with necessary data regarding your database. We have used **postgreql** in this project. To get the necessary variable names, check **.env_EXAMPLE** file. Also **timescaleDB** which is an extension of postgresql has been used here. To add the extension to your database, the script needs superuser privilages so username and password of database should be the superuser credentials.

* **./server.js** is the starting point of the applications.
  * Use nodemon with following command to run the server,in development mode: `npm run dev`
  * Use nodemon with following command to run the server in headless mode, in development mode: `npm run dev-h`
  * Use `node server.js` to run the application
  * Use `node server.js --headless` to run the application in headless mode (No UI updates supported)

* All RPCs have a rate-limit. To abide by the rate-limit rules of teh RPCs, we have implemented a bottleneck that servers as a middleware which all the outgoing requests are gone through it. Each RPC will have its own *Bottleneck* instance which can be configured in **/src/utils/requestLimiter.js**.

* When you press **start** on the dashboard page, the app will start getting quotes from the blockchain. This will run the **/src/quoteFetcher.js** file as a child task. Each task that you start will be added to the **tasks** table in the database. The quotes will be saved in the **prices** table in the database and updated real time in teh dashboard using a websocket connection to teh database. Every time a *UPDATE* or *INSERT* or *DELETE* operation is performed on **pairs** table, the database will emit a notification to the websocket server which will update the UI accordingly (These functions and notifications are defined in **./install/setupFunctions.js**).

* The database has the following tables which are described below
  * **pairs** - Stores information about trading pairs including blockchain, tokens, base/quote assets, contract addresses, exchange info, and latest quotes
  * **tasks** - Tracks running processes with status, process ID, timestamps, and additional information
  * **tokens** - Contains token information including symbol, blockchain, contract address, and decimal precision
  * **blacklist** - Stores addresses to be excluded from arbitrage opportunities, organized by blockchain
  * **prices** - A TimescaleDB hypertable that stores time-series price data including asset name, chain, timestamp, contract address, exchange details, and price values

* When running the app for the first time first run the **./install/setupTables.js** file to create the necessary tables in the database. The timeseries data of acquired prices will be saved in the **prices** table. After that, rin **./install/setupFunctions.js** to make the necessary postgreql functions and notifications. Then run the **./install/getPools.js** file to populate the table **pairs** and **tokens** tables (Will create this table if doesn't exist) with contract addresses for pools in various blockchains and pairs. Note that this file needs you to input three constants so it would run properly, **1. pairs** which stores which pairs we need to look for on what blockchain, and **2. tokenContractAddresses** which stores the contract addresses of the tokens that are in previously defined, pairs object. **3. quoteAssets** which denotes the prices of the assets, should be calculated with regards to these assets (For example if we want to calculate the price of a pool that has *FTM* and *USDT*, *USDT* will be considered as quote and *FTM* as the base asset. The order of the array is important and if we want to calculate price of a pool which as weth and *USDT*, *USDT* will be considered as the quote asset). An example for each variable is added below:

```javascript
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

        const quoteAssets = ["usdt", "dai", "usdc", "weth"]
```

* In all pairs that have stable coins in them (USDT, USDC, DAI), the stables are assumed to be the quote (PEPE/USDT), Also, if pairs have WETH in them (e.g. S/WETH or PEPE/WETH), WETH is taken to be the quote as well. I have denominated this in the table "pairs" as "base" and "quote" asset. This helps us with inconsistencies in a pair's price in different exchanges (For ETH and USDT, some may provide ETH/USDT but some may provide USDT/ETH by default).

* On the dashboard page, simply press ***start*** to start getting the quotes.

---

## install.js

Having the necessary pairs, gets respective contract addresses of the each pair in DEXs and adds the info into a database. The database name should be **arbitrageDB** and the table for pairs is called **pairs**.

---

## blockchainUtils.js

### Helper functions

Functions that help with general things that are needed inside classes in this file

### ethHandler

A class that is tasked with getting quotes in ethereum blockchain

### crawler

A class that is tasked with getting trading pair contract addresses for different chains and exchanges

---

## Technical notes

1. All the data is stored in a database. The database is called **arbitrageDB**. The table for pairs is called **pairs** and the table for tasks (Functions getting the quotes from the blockchain) is called **tasks**.

2. The UI updates using a websocket. The websocket is listening to database notifications and updates the UI accordingly. Each time table pairs is updated, deleted, or inserted, postgreql will emit a notification that will be picked up by the websocket server.

## TODOs

0. Add creating the database with "db_name" located in teh env file when running the **setupTables.js** file
1. Add router logic to controller directory and make router files logic-less.
2. Send batch requests to RPCs (Use axios?)
3. Add a section for manually checking if an RPC is okay and health (Not rate limited)
4. Add rate-limited calls for each limiter to the UI
5. Add a headless mode to run the app
