// Configures the database connection and returns the pool object

// Imports
import pg  from "pg"
import dotenv from "dotenv"
import databaseUtils from "../utils/dbUtils.js"
import { fileURLToPath } from 'url';
import path from 'path';

// Get the right path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Config environment variables
const {db_username, db_name, db_password, db_host, db_port} = process.env

// Get db pool object
const {Pool} = pg

// Config params
const dbConfig = {
    user: db_username,
    host: db_host,
    password: db_password,
    database: db_name,
    port: db_port || 5432,
}

// Make the Postgreql pool
const dbPool = new Pool(dbConfig)

// Test database connection
const dbConnection_check = await databaseUtils.testDatabaseConnection(dbPool)
const dbExistence_check = await databaseUtils.checkDatabaseExists(db_name, dbPool)

if (dbConnection_check && dbExistence_check) {
    console.log("Database connection successful")
} else if (!dbConnection_check) {
    console.log("Database connection failed")
    try{
        const dbCreation = await databaseUtils.createDatabase(dbConfig, db_name, true)

        if(dbCreation){
            console.log(`Created database ${db_name}`)
        }else{
            throw new Error(`Failed to create database ${db_name}`)
        }
    }
    catch (error) {
        throw new Error("Database connection failed")
    }
} else if (!dbExistence_check) {
    console.log(`Database ${db_name} doesn't exist`)
    throw new Error(`Database ${db_name} doesn't exist`)
}

// Export
export {dbPool}
