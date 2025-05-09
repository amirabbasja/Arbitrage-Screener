// Sends requests for getting quotes

const endPoints = [
    'http://localhost:3000/quote/eth/sushiswap_V3/0x769DB46F39C42ee7AD5f71F4167c47EdD281E767?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x7BeA39867e4169DBe237d55C8242a8f2fcDcc387?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V3/0x763d3b7296e7C9718AD5B058aC2692A19E5b3638?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V2/0x397FF1542f962076d0BFE58eA045FfA2d347ACa0?taskId=174',
    'http://localhost:3000/quote/eth/curveProtocol_tricrypto2/0xD51a44d3FaE010294C616388b506AcdA1bfAAE46?taskId=174',
    'http://localhost:3000/quote/eth/curveProtocol_unknown/0x5426178799ee0a0181A89b4f57eFddfAb49941Ec?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V3/0x72c2178E082feDB13246877B5aA42ebcE1b72218?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0xC5aF84701f98Fa483eCe78aF83F11b6C38ACA71D?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V3/0x1D437AC0a77d9d0Ab6A512A6b054930Aa582A5B7?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V2/0xC3D03e4F041Fd4cD388c549Ee2A29a9E5075882f?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V2/0x06da0fd433C1A5d7a4faa01111c044910A184553?taskId=174',
    'http://localhost:3000/quote/eth/sushiswap_V3/0x35644Fb61aFBc458bf92B15AdD6ABc1996Be5014?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0xa80964C5bBd1A0E95777094420555fead1A26c1e?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V2/0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852?taskId=174',
    'http://localhost:3000/quote/eth/curveProtocol_tricrypto/0x80466c64868E1ab14a1Ddf27A676C3fcBE638Fe5?taskId=174',
    'http://localhost:3000/quote/eth/curveProtocol_unknown/0xf5f5B97624542D72A9E06f04804Bf81baA15e2B4?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V2/0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V2/0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11?taskId=174',
    'http://localhost:3000/quote/eth/curveProtocol_unknown/0x7F86Bf177Dd4F3494b841a37e810A34dD56c829B?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x11b815efB8f581194ae79006d24E0d814B7697F6?taskId=174',
    'http://localhost:3000/quote/eth/uniswap_V3/0x60594a405d53811d3BC4766596EFD80fd545A270?taskId=174',
]

setInterval(async () => {
    let requestsToSend = endPoints.map((url) => {
        return fetch(url).then((res) => res.json())
    })
    
    await Promise.allSettled(requestsToSend).then((results) => {
        results.forEach((result) => {
            console.log(result.value.status)
        })
    })
    console.log("---")
}, 10000);
