# A screener for finding arbitrage opportunities on DEXs or CEXs

## Dependencies

1. Install *nodemon* for development

2. Install *marked* for compiling markdown language in help page

3. Install *pg*. The database uses Postgerql using *pg* package

4. Install *express* for web development

5. Install *web3* package for interacting with EVM blockchains

6. Install *dotenv* package for loading the env file

7. Install *bottleneck* package for limiting the request rate to RPCs

8. Install *socket.io* package for real-time updates UI via websockets

9. install *date-fns* package to convert UTC time to local time.

---

## How to work with this app

* Populate the **.env** file with necessary data regarding your database. We have used **postgreql** in this project. To get the necessary variable names, check **.env_EXAMPLE** file

* All RPCs have a rate-limit. To abide by the rate-limit rules of teh RPCs, we have implemented a bottleneck that servers as a middleware which all the outgoing requests are gone through it. Each RPC will have its own *Bottleneck* instance which can be configured in **/src/utils/requestLimiter.js**

* When running the app for the first time first run the **./install/setupTables.js** file to create the necessary tables in the database, After that, rin **./install/setupFunctions.js** to make the necessary postgreql functions and notifications. Then run the **./install/getPools.js** file to populate the table **pairs** and **tokens** tables (Will create this table if doesn't exist) with contract addresses for pools in various blockchains and pairs. Note that this file needs you to input three constants so it would run properly, **1. pairs** which stores which pairs we need to look for on what blockchain, and **2. tokenContractAddresses** which stores the contract addresses of the tokens that are in previously defined, pairs object. **3. quoteAssets** which denotes the prices of the assets, should be calculated with regards to these assets (For example if we want to calculate the price of a pool that has *FTM* and *USDT*, *USDT* will be considered as quote and *FTM* as the base asset. The order of the array is important and if we want to calculate price of a pool which as weth and *USDT*, *USDT* will be considered as the quote asset). An example for each variable is added below:

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

1. Add router logic to controller directory and make router files logic-less.
2. Send batch requests to RPCs (Use axios?)
