function formatNumber(num) {
    if (num >= 1) {
        return Number(num.toFixed(3));
    } else {
        return num.toExponential(3);
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

async function populatePairTables() {
    // Make the request to get all the table "pairs" as a big JSON object
    const response = await (await fetch("/pairs")).json()
    const data = response.data

    // Batch the assets that have the same token0 and token1
    const assets = batchObjectsByProperties(data.pairs, "token0", "token1")

    // Define the html
    let _html = ""
    let tableHtml = ""

    // Add tables
    for (let i = 0; i < assets.length; i++) {
        tableHtml = `<table class="centered-table">\n`

        // Add headers
        tableHtml += `\t<tr>\n`
        tableHtml += `\t\t<th>Asset Name</th>\n`
        for(let j = 0; j < assets[i].length; j++){
            tableHtml += `\t\t<th class="table-header">${assets[i][j].exchange}_${assets[i][j].exchange_type}<br>(${assets[i][j].blockchain})</th>\n`
        }
        tableHtml += `\t</tr>\n`

        // Add rows
        tableHtml += `\t<tr>\n`
        tableHtml += `\t\t<td>${assets[i][0].token0.toUpperCase()}/${assets[i][0].token1.toUpperCase()}</td>\n`
        for(let j = 0; j < assets[i].length; j++){
            tableHtml += `
            \t\t<td id="${assets[i][j].blockchain}_${assets[i][j].exchange}_${assets[i][j].exchange_type}_${assets[i][0].token0.toUpperCase()}${assets[i][0].token1.toUpperCase()}">
                <span id-"${assets[i][j].contract_address}">NAN</span>
            </td>\n
            `
        }
        tableHtml += `\t</tr>\n</table>\n`
        _html += tableHtml
    }

    // Add to body
    document.body.innerHTML += _html
}

async function tmpFcn(){
    const cell = document.getElementById("eth_uniswap_v2_ETHUSDT")
    const url = `/quote/eth/uniswapV2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc/`

    const response = await (await fetch(url)).json()
    const data = response.data
    let quote = "----"

    if (response.status === "success") {
        quote = formatNumber(data.quote.price)
    }

    cell.textContent = quote
}

window.addEventListener('load', tmpFcn)
window.addEventListener('load', populatePairTables)