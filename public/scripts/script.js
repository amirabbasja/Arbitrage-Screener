/**
 * Formats a number's decimal points
 * @param {Number} num - The number to format 
 * @returns 
 */
function formatNumber(num) {
    // Don't try to format "ERR" strings
    if (num === "ERR") { return "ERR" }

    // If the number is zero, return it as is
    if (num === 0) return '0';
    
    // Get the absolute value to handle negative numbers
    const absNum = Math.abs(num);

    // Check if the number is very small (less than 0.0001)
    if (absNum < 0.0001) {
        // Use scientific notation with 4 significant digits
        return num.toExponential(3); // 3 decimal places + 1 digit before decimal = 4 significant digits
    } else {
        // For regular numbers, use toFixed to get 4 decimal places
        return parseFloat(parseFloat(num).toFixed(4)).toString();
    }
}

/**
 * Groups objects in an array based on two matching properties
 * @param {Array} array - Array of objects to batch
 * @param {string} prop1 - First property to match
 * @param {string} prop2 - Second property to match
 * @returns {Array} Array of batched object groups
 */
function batchObjectsByProperties(array, prop1, prop2) {
    // Create a map to store batches
    const batches = new Map();

    // Group objects by the combination of both properties
    array.forEach(obj => {
        // Create a unique key based on both properties
        const key = `${obj[prop1]}_${obj[prop2]}`;

        if (!batches.has(key)) {
            batches.set(key, []);
        }

        batches.get(key).push(obj);
    });

    // Convert map values to array
    return Array.from(batches.values());
}

/**
 * Makes the necessary tables in html so that they can later be populated 
 * with quotes
 */
async function populatePairTables() {
    
    // Function to copy table cell ID to clipboard
    function setupCellIdCopy() {
        // Create popup element if it doesn't exist
        let popup = document.getElementById('copy-popup');
        if (!popup) {
        popup = document.createElement('div');
        popup.id = 'copy-popup';
        popup.style.position = 'fixed';
        popup.style.bottom = '20px';
        popup.style.right = '20px';
        popup.style.backgroundColor = '#333';
        popup.style.color = 'white';
        popup.style.padding = '10px 15px';
        popup.style.borderRadius = '4px';
        popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        popup.style.opacity = '0';
        popup.style.transition = 'opacity 0.3s ease-in-out';
        popup.style.zIndex = '9999';
        document.body.appendChild(popup);
        }

        // Get all table cells
        const cells = document.querySelectorAll('td');
        
        // Add click event listener to each cell
        cells.forEach(cell => {
        cell.addEventListener('click', function() {
            // Get the cell's ID
            let cellId = this.querySelector("span");
            
            if (cellId) {
            // Copy to clipboard
                cellId = cellId.id
                navigator.clipboard.writeText(cellId.split("_")[1])
                    .then(() => {
                        // Visual feedback on the cell
                        const originalBg = this.style.backgroundColor;
                        this.style.backgroundColor = '#e6ffe6'; // Light green flash
                        
                        // Reset background after a short delay
                        setTimeout(() => {
                            this.style.backgroundColor = originalBg;
                        }, 300);
                        
                        // Show popup notification
                        popup.textContent = `Copied contract address: ${cellId.split("_")[1]}`;
                        popup.style.opacity = '1';
                        
                        // Hide popup after 2 seconds
                        setTimeout(() => {
                            popup.style.opacity = '0';
                        }, 2000);
                        
                        // console.log('Cell ID copied to clipboard: ' + cellId);
                    })
                    .catch(err => {
                        // console.error('Failed to copy cell ID: ', err);
                    });
            } else {
                // console.warn('This cell has no ID');
            }
        });
    });
    }
    
    // Make the request to get all the table "pairs" as a big JSON object
    const response = await (await fetch("/pairs")).json()
    const data = response.data

    // Batch the assets that have the same token0 and token1
    const assets = batchObjectsByProperties(data.pairs, "token0", "token1")
    console.log(assets)
    // Define the html
    let _html = ""
    let tableHtml = ""

    // Add tables
    for (let i = 0; i < assets.length; i++) {
        tableHtml = `<table class="centered-table" id="table-${assets[i][0].token0.toUpperCase()}-${assets[i][0].token1.toUpperCase()}">\n`

        // Add headers
        tableHtml += `\t<tr>\n`
        tableHtml += `\t\t<th>Asset Name</th>\n`
        for(let j = 0; j < assets[i].length; j++){
            tableHtml += `\t\t<th class="table-header">${assets[i][j].exchange}_${assets[i][j].exchange_type}<br>(${assets[i][j].blockchain})</th>\n`
        }
        tableHtml += `\t</tr>\n`

        // Add rows
        tableHtml += `\t<tr>\n`
        tableHtml += `\t\t<td>${assets[i][0].base_asset.toUpperCase()}/${assets[i][0].quote_asset.toUpperCase()}</td>\n`
        for(let j = 0; j < assets[i].length; j++){
            tableHtml += `
            \t\t<td id="${assets[i][j].blockchain}_${assets[i][j].exchange}_${assets[i][j].exchange_type}_${assets[i][0].token0.toUpperCase()}${assets[i][0].token1.toUpperCase()}">
                <span id="${assets[i][j].blockchain}_${assets[i][j].contract_address}">${assets[i][j].latest_quote? formatNumber(assets[i][j].latest_quote.price) : "NAN"}</span>
            </td>\n
            `
        }
        tableHtml += `\t</tr>\n</table>\n`
        _html += tableHtml
    }

    // // Add to body
    const tableContainer = document.createElement("div")
    tableContainer.innerHTML = _html
    document.body.appendChild(tableContainer)
    
    setupCellIdCopy()
    console.log("finished")
}

/**
 * Updates the quotes of the main page by running the quoteFetcher.js script.
 */
async function updateQuotes(){
    const activationBtn = document.getElementById("activation-btn")

    activationBtn.addEventListener("click", async () => {
        const response = await (await fetch("/quote/quoteFetcher")).json()
        const data = response.data
        const startNewFetcher = data.tasks.every(task => task.status !== "running")

        // Start the quote fetcher script when start button is clicked. Stop it when It is clicked again.
        if(startNewFetcher){
            const response = await (await fetch("/quote/quoteFetcher", {method: "POST"})).json()
            if (response.status === "success") {
                // Change button style
                document.getElementById("activation-btn").textContent = "Stop"
                document.getElementById("activation-btn").classList.remove("start-btn")
                document.getElementById("activation-btn").classList.add("stop-btn")
            }
        }else{
            // Get all running tasks and terminate them
            const _response = await (await fetch("/quote/quoteFetcher")).json()
            const _runningTasks = _response.data.tasks.filter( task => task.status === "running")
            _runningTasks.forEach(async (task) => {
                try{await fetch(`/quote/quoteFetcher/${task.id}`, {method: "DELETE"})}
                catch(err){console.log(err)}
            });

            // Change button style
            document.getElementById("activation-btn").classList.remove("stop-btn")
            document.getElementById("activation-btn").classList.add("start-btn")
            document.getElementById("activation-btn").textContent = "Start"
        }

    })
}

/**
 * By always checking the database, it updates the table cells with new quotes
 */
async function quotesUpdater() {
    
}

/**
 * Checks if the quote fetcher script is running or not, If so, change the button style
 */
async function startBtnLoad(){
    const response = await (await fetch("/quote/quoteFetcher")).json()
    const data = response.data
    const runningTasks = data.tasks.every(task => task.status !== "running")
    if (runningTasks) {
        document.getElementById("activation-btn").textContent = "Start"
        document.getElementById("activation-btn").classList.remove("stop-btn")
        document.getElementById("activation-btn").classList.add("start-btn")
    }else{
        document.getElementById("activation-btn").textContent = "Stop"
        document.getElementById("activation-btn").classList.remove("start-btn")
        document.getElementById("activation-btn").classList.add("stop-btn")
    }
}



document.addEventListener("topMenuLoaded", updateQuotes)
window.addEventListener('load', populatePairTables)
window.addEventListener("load", quotesUpdater)
window.addEventListener("load", startBtnLoad)
