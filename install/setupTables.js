// Sets up necessary tables for running the application
import dotenv from "dotenv"
import {join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import databaseUtils from "../src/utils/dbUtils.js"
import {dbPool} from "../src/config/db.js"

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

// Create pairs table if doesn't exist
if(! await databaseUtils.checkTableExists("pairs", dbPool, "public")){
    const _query = 
        `
            id SERIAL PRIMARY KEY,
            blockchain VARCHAR(255) NOT NULL,
            token0 VARCHAR(255) NOT NULL,
            token1 VARCHAR(255) NOT NULL,
            exchange VARCHAR(255) NOT NULL,
            exchange_type VARCHAR(255) NOT NULL,
            contract_address VARCHAR(255) NOT NULL,
            extra_info VARCHAR(255) NOT NULL,
            latest_quote JSONB
        `
    await databaseUtils.createTable("pairs", dbPool, _query)
}

// Create tasks table if doesn't exist
if(! await databaseUtils.checkTableExists("tasks", dbPool, "public")){
    const _query = 
        `
            id SERIAL PRIMARY KEY,
            status VARCHAR(20) NOT NULL,
            pid INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        `
    await databaseUtils.createTable("tasks", dbPool, _query)
}

// Create tokens table if doesn't exist
if(! await databaseUtils.checkTableExists("tokens", dbPool, "public")){
    const _query = 
        `
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(50) NOT NULL,
            blockchain VARCHAR(50) NOT NULL,
            contract_address VARCHAR(255) NOT NULL,
            decimals INT NOT NULL,
            extra_info TEXT
        `
    await databaseUtils.createTable("tokens", dbPool, _query)
}