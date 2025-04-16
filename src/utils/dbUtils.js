import pg  from "pg"
import assert from "assert"
const {Pool} = pg

/**
 * Test database connection
 * @param {Pool} pool - Pool of database connections
 * @param {boolean} verbose - Optional flag to enable verbose logging
 * @returns {Promise<boolean>} - True if connection is successful, false otherwise
 */
async function testDatabaseConnection(pool, verbose = false) {
    try {
        await pool.query('SELECT NOW()') 
        return true
    } catch (error) {
        if (verbose) {console.error('Database connection failed:', error)}
        return false
    }
}

/**
 * Create a database with specific name. Need to connect to default postgers database 
 * named "postgres". If not found, an error will be thrown.
 * @param {JSON} dbInfo - Database connection info, containing keys "host", "port", "user", "password
 * @param {String} dbName - Name of the database
 * @param {boolean} verbose - Optional flag to enable verbose logging
 * @returns {Promise<boolean>} - True if creation is successful, false otherwise
 */
async function createDatabase(dbInfo, dbName, verbose = false) {
    
    try{
        // Connect to default postgres database first
        const pool = new Pool({
            host: dbInfo.host,
            port: dbInfo.port,
            user: dbInfo.user,
            password: dbInfo.password,
            database: 'postgres' // Connect to default db to create a new one
        })

        try {
            await pool.query(`CREATE DATABASE "${dbName}"`) 
            await pool.end()
            return true
        } catch (error) {
            if (verbose) {console.error('Database creation failed:', error)}
            await pool.end()
            return false
        }
    } catch (error) {
        if (verbose) {console.error("Could not connect to default database postgres. Create the database manually.")}
        return false
    }
}

/**
 * Check if a database exists
 * @param {string} databaseName - Name of the database to check
 * @param {Pool} pool - Pool of database connections
 * @param {boolean} verbose - Optional flag to enable verbose logging
 * @returns {Promise<boolean>} - True if database exists, false otherwise
 */
async function checkDatabaseExists(databaseName, pool, verbose = false) {
    try {
        const result = await pool.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [databaseName]
        )
        // console.log(result.rowCount > 0)
        return result.rowCount > 0
    } catch (error) {
        if (verbose) {console.error('Error checking if database exists:', error)}
        return false
    } 
}

/**
 * Check if a table exists in the current database
 * @param {string} tableName - Name of the table to check
 * @param {Pool} pool - Pool of database connections
 * @param {string} schemaName - Schema name (default: 'public')
 * @param {boolean} verbose - Optional flag to enable verbose logging
 * @returns {Promise<boolean>} - True if table exists, false otherwise
 */
async function checkTableExists(tableName, pool, schemaName = 'public', verbose = false) {
    try {
        const result = await pool.query(
            'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
            [schemaName, tableName]
        )
        return result.rowCount > 0
    } catch (error) {
        if (verbose) {console.error('Error checking if table exists:', error)}
        throw error
    }
}

/**
 * Create a table in the current database
 * @param {string} tableName - Name of the table to create
 * @param {Pool} pool - Pool of database connections
 * @param {string} columnsDefinition - SQL column definitions (e.g., "id SERIAL PRIMARY KEY, name TEXT NOT NULL")
 * @returns {Promise<void>}
 */
async function createTable(tableName, pool, columnsDefinition) {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnsDefinition})`)
    } catch (error) {
        console.error(`Error creating table ${tableName}:`, error)
        throw error
    }
}

/**
 * Adds a row to a table
 * @param {string} tableName - Name of the table
 * @param {Object} data - Object containing column names and values
 * @param {Pool} pool - Pool of database connections
 * @returns {Promise} - Promise resolving to the inserted row
 */
async function addRow(tableName, data, pool) {
    try {
        const columns = Object.keys(data).join(', ')
        const values = Object.values(data).map((value) => `'${value}'`).join(', ')
        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${values}) RETURNING *`
        
        const result = await pool.query(query)
        return result.rows[0]
    } catch (error) {
        console.error(`Error adding row to table ${tableName}:`, error)
        throw error
    }
}

/**
 * Fetches all records from a specified PostgreSQL table
 * 
 * @param {string} tableName - The name of the table to fetch data from
 * @param {Pool} pool - The pool of database connections
 * @returns {Promise<Array>} A promise that resolves to an array of row objects
 * @throws Will throw an error if the database connection or query fails
 */
async function getAllFromTable(tableName, pool) {
    try {
        // Construct and execute the query
        const query = `SELECT * FROM ${tableName}`
        const result = await pool.query(query)
        
        // Return all rows from the query result
        return result.rows
    } catch (error) {
        console.error('Error fetching data:', error)
        throw error
    }
}

/**
 * Retrieves a single entry from a PostgreSQL table based on specific conditions.
 * 
 * @param {string} tableName - The name of the table to query
 * @param {Object} conditions - An object containing column/value pairs for filtering
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} options - Additional query options
 * @param {string[]} [options.fields] - Specific fields to return (defaults to all)
 *      To pass multiple fields, embed them in an array. If you need a single column,
 *      passing a single string would suffice as well.
 * @param {Object} [options.sort] - Sorting criteria {field: 'asc'|'desc'}
 * @returns {Promise<Object|null>} The found entry or null if not found
 * @throws {Error} If the database query fails
 */
async function getEntry(tableName, conditions, pool, options = {}) {
    // Default to select all fields.
    const fields = 
        (options.fields && options.fields.length > 0) ? 
        (! Array.isArray(options.fields)) ? options.fields :  options.fields.join(', ') : 
        '*'

    // Build the WHERE clause
    const whereParams = []
    const whereClauses = []

    Object.entries(conditions).forEach(([column, value], index) => {
        whereClauses.push(`${column} = $${index + 1}`)
        whereParams.push(value)
    })

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    // Build the ORDER BY clause
    let orderByClause = ''

    if (options.sort) {
        const sortItems = Object.entries(options.sort)
        .map(([field, direction]) => `${field} ${direction}`)
        .join(', ')
        
        if (sortItems) {
        orderByClause = `ORDER BY ${sortItems}`
        }
    }

    // Construct the full query
    const query = `SELECT ${fields} FROM ${tableName} ${whereClause} ${orderByClause} LIMIT 1`
    try {
        const result = await pool.query(query, whereParams)
        return result.rows.length > 0 ? result.rows[0] : null
    } catch (error) {
        throw new Error(`Failed to retrieve entry from ${tableName}: ${error.message}`)
    }
}

/**
 * Retrieves an entire table and returns it as a JSON object
 * @param {string} tableName - The name of the table to retrieve
 * @param {Pool} pool - The pool of database connections
 * @returns {Promise<Array>} - Promise resolving to an array of row objects
 */
const getTableAsJson = async (tableName, pool) => {
    try {
        // Query the table
        const result = await pool.query(`SELECT * FROM ${tableName}`);

        // Return the rows as JSON
        return result.rows;
    } catch (error) {
        console.error('Error retrieving table data:', error);
        throw error;
    }
};

/**
 * Deletes a single entry from a PostgreSQL table based on specific conditions.
 * 
 * @param {string} tableName - The name of the table to delete from
 * @param {Object} conditions - An object containing column/value pairs for filtering
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.returning=false] - Whether to return the deleted row
 * @returns {Promise<Object|number>} The deleted row if returning=true, or count of affected rows
 * @throws {Error} If the database operation fails
 */
async function deleteEntry(tableName, conditions, pool, options = {}) {
    // Build the WHERE clause
    const whereParams = []
    const whereClauses = []
    
    Object.entries(conditions).forEach(([column, value], index) => {
        whereClauses.push(`${column} = $${index + 1}`)
        whereParams.push(value)
    })
    
    if (whereClauses.length === 0) {
        throw new Error('At least one condition is required for safety')
    }
    
    const returningClause = options.returning ? 'RETURNING *' : ''
    
    // Construct the delete query
    const query = `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')} ${returningClause}`
    
    try {
        const result = await pool.query(query, whereParams)
        return options.returning ? (result.rows[0] || null) : result.rowCount
    } catch (error) {
        throw new Error(`Failed to delete entry from ${tableName}: ${error.message}`)
    }
}

/**
 * Updates records in the specified PostgreSQL table based on custom conditions
 * 
 * @param {string} tableName - Name of the table to update records in
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} conditions - Object containing column names and values for WHERE clause
 * @param {Object} updates - Object containing column names and values to update
 * @returns {Promise<Object[]>} Array of updated record data
 * @throws {Error} If database connection fails or query execution fails
 */
async function updateRecords(tableName, pool, conditions, updates) {
    try {
      // Build SET clause from updates object
        const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(", ")
        
        let whereClause = ''
        let values = [...Object.values(updates)]
        
        // Build WHERE clause from conditions object
        if (Object.keys(conditions).length > 0) {
        whereClause = 'WHERE ' + Object.keys(conditions)
            .map((key, index) => `${key} = $${index + 1 + Object.keys(updates).length}`)
            .join(" AND ")
        
        values = [...values, ...Object.values(conditions)]
        }
        
        const query = `UPDATE ${tableName} SET ${setClause} ${whereClause} RETURNING * `
        
        const result = await pool.query(query, values)
        
        return result.rows
    } catch (error) {
        throw new Error(`Failed to update records: ${error.message}`)
    }
}

export default { 
    testDatabaseConnection,
    checkDatabaseExists,
    checkTableExists,
    getAllFromTable,
    createDatabase,
    getTableAsJson,
    updateRecords,
    createTable,
    deleteEntry,
    getEntry,
    addRow,
}