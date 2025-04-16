// Sets up necessary tables for running the application
import dotenv from "dotenv"
import {join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import databaseUtils from "../src/utils/dbUtils.js"
import {dbPool} from "../src/config/db.js"

let verbose = true

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

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