// Creates SQL functions and notifications in the database
import dotenv from "dotenv"
import {join} from "path"
import {getDirPath, crawler} from "../src/utils/blockchainUtils.js"
import {dbPool} from "../src/config/db.js"

// Get the api key from the .env file
dotenv.config({ path: join(getDirPath(), "../../.env") })

// SQL command to create the function (Used in real-time updating of table pairs)
const createFunctionSQL = `
CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger AS $$
DECLARE
    payload json;
BEGIN
    -- Create different payloads based on operation type
    IF (TG_OP = 'DELETE') THEN
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', OLD.id,
            'old_data', row_to_json(OLD)
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', NEW.id,
            'old_data', row_to_json(OLD),
            'new_data', row_to_json(NEW),
            'changed_fields', (
                SELECT json_object_agg(key, value)
                FROM json_each(row_to_json(NEW))
                WHERE json_extract_path_text(row_to_json(OLD), key) IS DISTINCT FROM 
                    json_extract_path_text(row_to_json(NEW), key)
            )
        );
    ELSE -- INSERT
        payload = json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', NEW.id,
            'new_data', row_to_json(NEW)
        );
    END IF;

    -- Send notification with the payload
    PERFORM pg_notify('table_change', payload::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

// SQL command to create the trigger (Used in real-time updating of table pairs)
const createTriggerSQL = `
CREATE TRIGGER table_change
AFTER INSERT OR UPDATE OR DELETE ON pairs
FOR EACH ROW EXECUTE PROCEDURE notify_change();
`

// Function to set up the database
async function setupDatabase() {
    try {
        // Create or replace the function
        await dbPool.query(createFunctionSQL)
        console.log('Function created successfully.')

        // Create the trigger
        await dbPool.query(createTriggerSQL)
        console.log('Trigger created successfully.')
    } catch (err) {
        console.error('Error creating function or trigger:', err)
    } finally {
        // Close the connection (optional, depending on your app)
        await dbPool.end()
    }
}

// Run the setup
setupDatabase()