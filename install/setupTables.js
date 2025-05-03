// Sets up necessary tables for running the application
import dotenv from "dotenv"
import {join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import databaseUtils from "../src/utils/dbUtils.js"
import {dbPool} from "../src/config/db.js"
import pg from "pg"
const {Pool} = pg

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
            base_asset VARCHAR(255) NOT NULL,
            quote_asset VARCHAR(255) NOT NULL,
            token0_address VARCHAR(255) NOT NULL,
            token1_address VARCHAR(255) NOT NULL,
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
            updated_at TIMESTAMP NOT NULL,
            extra_info JSONB
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
            extra_info JSONB
        `
    await databaseUtils.createTable("tokens", dbPool, _query)
}

// Create blacklist table if doesn't exist
if(! await databaseUtils.checkTableExists("blacklist", dbPool, "public")){
    const _query = 
        `
            address VARCHAR(255) NOT NULL,
            chain VARCHAR(255) NOT NULL,
            PRIMARY KEY (address, chain)
        `
    await databaseUtils.createTable("blacklist", dbPool, _query)
    console.log("Blacklist table created successfully")
}

// Check if TimescaleDB extension is installed and create prices table
try {
    // Check if TimescaleDB extension exists
    const extensionQuery = `
        SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
        );
    `
    const extensionResult = await dbPool.query(extensionQuery);
    let timescaleExists = extensionResult.rows[0].exists;
    
    if (!timescaleExists) {
        console.log("TimescaleDB extension not found. Attempting to install it...")
        try {
            // Try to create the extension with regular connection
            await dbPool.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;')
            console.log("TimescaleDB extension installed successfully.")
            timescaleExists = true;
        } catch (extError) {
            console.log("Failed with regular user, attempting with superuser connection...")
            
            // Get database connection info from current pool
            const currentConfig = dbPool.options
            
            // Create a temporary superuser connection
            const superUserPool = new Pool({
                user: 'postgres', // Default superuser
                host: currentConfig.host || 'localhost',
                database: currentConfig.database,
                password: process.env.db_password || 'postgres', // Use env var or default
                port: currentConfig.port || 5432,
            })
            
            try {
                // Try to create the extension with superuser privileges
                await superUserPool.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;')
                console.log("TimescaleDB extension installed successfully with superuser.")
                timescaleExists = true
                
                // Close the superuser connection
                await superUserPool.end()
            } catch (superUserError) {
                console.error("Failed to install TimescaleDB extension with superuser:", superUserError.message)
                console.log("Please make sure TimescaleDB is installed on your PostgreSQL server.")
                console.log("You need to:")
                console.log("1. Add 'shared_preload_libraries = timescaledb' to postgresql.conf")
                console.log("2. Restart PostgreSQL service")
                console.log("3. Run: CREATE EXTENSION timescaledb; as a superuser")
                
                // Close the superuser connection
                await superUserPool.end()
            }
        }
    } else {
        console.log("TimescaleDB extension already exists.");
    }
    
    if (timescaleExists) {
        console.log("Setting up prices table...")
        
        // Create prices table if it doesn't exist
        if (!await databaseUtils.checkTableExists("prices", dbPool, "public")) {
            const pricesTableQuery = `
                CREATE TABLE prices (
                    asset_name VARCHAR(255) NOT NULL,
                    chain VARCHAR(255) NOT NULL,
                    time TIMESTAMPTZ NOT NULL,
                    contract_address VARCHAR(255) NOT NULL,
                    exchange_name VARCHAR(255) NOT NULL,
                    exchange_version VARCHAR(255) NOT NULL,
                    price NUMERIC NOT NULL
                );
            `
            
            await dbPool.query(pricesTableQuery)
            
            // Convert to hypertable
            const hypertableQuery = `
                SELECT create_hypertable('prices', 'time');
            `
            
            await dbPool.query(hypertableQuery)
            console.log("Prices timeseries table created successfully")
        } else {
            console.log("Prices table already exists")
        }
    } else {
        console.log("TimescaleDB extension not available. Skipping prices table creation.")
    }
} catch (error) {
    console.error("Error setting up TimescaleDB:", error)
}
