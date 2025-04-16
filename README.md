# A screener for finding arbitrage opportunities on DEXs or CEXs

## Dependencies

1. Install *nodemon* for development

2. Install *marked* for compiling markdown language in help page

3. Install *pg*. The database uses Postgerql using *pg* package

4. Install *express* for web development

5. Install *web3* package for interacting with EVM blockchains

6. Install *dotenv* package for loading the env file

---

## How to work with this app

* Populate the **.env** file with necessary data regarding your database. We have used **postgreql** in this project. To get the necessary variable names, check **.env_EXAMPLE** file

* When running the app for the first time, run the **./install/getPools.js** file to populate the table **pairs** (Will create this table if doesn't exist) with contract addresses for pools in various blockchains and pairs. Note that this file needs you to input two constants so it would run properly, **1. pairs** which stores which pairs we need to look for on what blockchain, and **2. tokenContractAddresses** which stores the contract addresses of the tokens that are in previously defined, pairs object. An example for each variable is added below:

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
```

* On the dashboard page, simply press ***start*** to start getting the quotes

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

## TODOs

1. Add router logic to controller directory and make router files logic-less.
