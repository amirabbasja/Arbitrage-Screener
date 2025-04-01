function formatNumber(num) {
    if (num >= 1) {
        return Number(num.toFixed(2));
    } else {
        return num.toExponential(2);
    }
}

async function tmpFcn(){
    const cell = document.getElementById("eth_uniswap_v2_ETHUSDT")
    const url = `/quote/uniswapV2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc/`

    const response = await (await fetch(url)).json()
    const data = response.data
    let quote = "----"

    if (response.status === "success") {
        quote = formatNumber(data.quote.price)
    }
    console.log(data)

    cell.textContent = quote
}


window.onload = await tmpFcn