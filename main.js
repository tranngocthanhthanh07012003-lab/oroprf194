const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { SigningCosmWasmClient, CosmWasmClient } = require('@cosmjs/cosmwasm-stargate');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { calculateFee, GasPrice } = require('@cosmjs/stargate');
const http = require('http');

const PORT = process.env.PORT || 3000;
// Lấy URL của app từ Render dashboard
const APP_URL = 'https://oroprf194.onrender.com';

// Ping mỗi 10 phút để không sleep
setInterval(async () => {
    try {
        const response = await fetch(APP_URL);
        console.log(`🏓 Keep-alive: ${new Date().toLocaleString()}`);
    } catch (error) {
        console.log('❌ Ping failed:', error.message);
    }
}, 10 * 60 * 1000); // 10 phút
// Tạo HTTP server đơn giản
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OROSWAP BOT is running!');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
console.clear();
console.log("\x1b[35m%s\x1b[0m", "============================================");
console.log("\x1b[36m%s\x1b[0m", "      OROSWAP BOT - VÍ KEPLR/LEAP       ");
console.log("\x1b[36m%s\x1b[0m", "               VELHUST                   ");
console.log("\x1b[35m%s\x1b[0m", "============================================\n");

// Định nghĩa trực tiếp mảng MNEMONICS, cách nhau dấu phẩy
const MNEMONICS = [
    "ripple still finish quit execute shiver hundred market slice ice fade fragile",
    "layer enhance tissue approve skill icon topple proof point require lawsuit artefact",
     "desk clever aisle worry brisk unable loop toddler attitude kite grab bind",
     "gravity furnace there foster tray neither rubber tiger battle sorry interest cream",
     "candy drama drip width cherry wife august dignity either stick immune matter",
     "venture lab zoo wrist canyon produce venue army deer anger capable amateur",
     "leopard gift guide skull develop link celery north person vapor soda trick",
     "rebel slender business thing this juice visa urban gospel few like face",
     "chapter unable wagon select speak foam mass actor wheel monster special behave",
     "very summer hub possible direct rather wealth duty sunny silver lawn scheme",
     "leave airport tongue gown room fancy wash egg jump again beach noble",
     "crawl scale tiny check spike suspect mask attack curtain beef load air",
     "uphold flame time olympic crew tortoise thing tank water mercy amazing cable",
     "dice cry concert zebra mobile child actor pink problem lunch soccer wink"
].map(m => m.trim());

console.log(`✅ Đã load ${MNEMONICS.length} ví trực tiếp từ code`);

const CONFIG = {
    rpcEndpoint: "https://public-zigchain-testnet-rpc.numia.xyz",
    chainId: "zig-test-2",
    zigDenom: "uzig",
    oroDenom: "coin.zig10rfjm85jmzfhravjwpq3hcdz8ngxg7lxd0drkr.uoro",
    swapContract: "zig15jqg0hmp9n06q0as7uk3x9xkwr9k3r7yh4ww2uc0hek8zlryrgmsamk4qg",
    gasPrice: GasPrice.fromString("0.025uzig"),
};

function randomAmount() {
    const min = 0.0001;
    const max = 0.0009;
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(4));
}

const ZIG_AMOUNT = randomAmount();
const ORO_AMOUNT = randomAmount();

function randomLiqValueAsString() {
  const min = 0.001;
  const max = 0.009;
  const random = Math.random() * (max - min) + min;
  return random.toFixed(4); // Chuỗi có 4 chữ số thập phân
}

const LIQ_ORO = randomLiqValueAsString();
const LIQ_ZIG = randomLiqValueAsString();

const delay = async (ms) => {
    process.stdout.write(`\r⏳ Đang chờ ${ms / 1000} giây... `);
    await new Promise(res => setTimeout(res, ms));
    console.log("✅ Hoàn thành chờ");
};

async function getBalance(mnemonic, denom) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "zig" });
    const [account] = await wallet.getAccounts();
    const client = await CosmWasmClient.connect(CONFIG.rpcEndpoint);
    const balance = await client.getBalance(account.address, denom);
    return { address: account.address, amount: balance.amount, formatted: Number(balance.amount) / 1e6 };
}

async function getBeliefPrice(denom, amount) {
    const client = await CosmWasmClient.connect(CONFIG.rpcEndpoint);
    const sim = await client.queryContractSmart(CONFIG.swapContract, {
        simulation: {
            offer_asset: {
                amount,
                info: { native_token: { denom: denom } }
            }
        }
    });
    const beliefPrice = (BigInt(amount) * BigInt(1e6)) / BigInt(sim.return_amount);
    return (Number(beliefPrice) / 1e6).toFixed(18);
}

async function swap(mnemonic, amount, fromDenom, toDenom) {
    try {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "zig" });
        const [account] = await wallet.getAccounts();
        const client = await SigningCosmWasmClient.connectWithSigner(CONFIG.rpcEndpoint, wallet, {
            gasPrice: CONFIG.gasPrice, chainId: CONFIG.chainId
        });

        const baseAmount = Math.floor(amount * 1e6).toString();
        const beliefPrice = await getBeliefPrice(fromDenom, baseAmount);
        const fee = calculateFee(320000, CONFIG.gasPrice);

        const msg = {
            swap: {
                belief_price: beliefPrice,
                max_spread: "0.005",
                offer_asset: {
                    amount: baseAmount,
                    info: { native_token: { denom: fromDenom } }
                }
            }
        };

        const result = await client.execute(account.address, CONFIG.swapContract, msg, fee, "Swap", [
            { denom: fromDenom, amount: baseAmount }
        ]);

        const fromName = fromDenom === CONFIG.zigDenom ? "ZIG" : "ORO";
        const toName = toDenom === CONFIG.zigDenom ? "ZIG" : "ORO";
        console.log(`\n✅ Swap ${fromName} → ${toName} thành công! TX: ${result.transactionHash}`);
        console.log(`🔍 https://zigscan.org/tx/${result.transactionHash}`);
    } catch (e) {
        console.error(`❌ Swap thất bại:`, e.message);
    }
}

async function addLiquidity(mnemonic, amountUoro, amountUzig) {
    try {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "zig" });
        const [account] = await wallet.getAccounts();
        const client = await SigningCosmWasmClient.connectWithSigner(CONFIG.rpcEndpoint, wallet, {
            gasPrice: CONFIG.gasPrice, chainId: CONFIG.chainId
        });

        // Chuyển đổi amountUoro và amountUzig thành số nguyên (nhân với 1e6)
        const uoroBaseAmount = Math.floor(Number(amountUoro) * 1e6).toString();
        const uzigBaseAmount = Math.floor(Number(amountUzig) * 1e6).toString();

        const msg = {
            provide_liquidity: {
                assets: [
                    {
                        amount: uoroBaseAmount,
                        info: { native_token: { denom: CONFIG.oroDenom } }
                    },
                    {
                        amount: uzigBaseAmount,
                        info: { native_token: { denom: CONFIG.zigDenom } }
                    }
                ],
                slippage_tolerance: "0.5"
            }
        };

        const funds = [
            { denom: CONFIG.oroDenom, amount: uoroBaseAmount },
            { denom: CONFIG.zigDenom, amount: uzigBaseAmount }
        ];

        const fee = calculateFee(320000, CONFIG.gasPrice);

        const result = await client.execute(account.address, CONFIG.swapContract, msg, fee, "Swap", funds);

        console.log(`\n✅ Cung cấp thanh khoản cặp ORO/ZIG thành công! TX: ${result.transactionHash}`);
        console.log(`🔍 https://zigscan.org/tx/${result.transactionHash}`);
    } catch (err) {
        console.error("❌ Thêm thanh khoản thất bại:", err.message);
    }
}

// Hàm xử lý một ví đơn lẻ (bao gồm tất cả swap và addLiquidity cho ví đó)
async function processWallet(mnemonic, walletIndex) {
    console.log(`\n📱 Xử lý ví ${walletIndex + 1}: ${mnemonic.slice(0, 10)}...`);

    for (let i = 0; i < 100; i++) {
        await swap(mnemonic, ZIG_AMOUNT, CONFIG.zigDenom, CONFIG.oroDenom);
        await delay(10000);
    }

    for (let i = 0; i < 100; i++) {
        await swap(mnemonic, ORO_AMOUNT, CONFIG.oroDenom, CONFIG.zigDenom);
        await delay(10000);
    }

    // for (let i = 0; i < 10; i++) {
    //     console.log("\n💧 Đang thêm thanh khoản...");
    //     await addLiquidity(mnemonic, LIQ_ORO, LIQ_ZIG);
    //     await delay(60000);
    // }
}

async function runBot() {
    for (let liqCount = 0; liqCount < 10000000000; liqCount++) {
        console.log(`\n=== Chu kỳ Swap thứ ${liqCount + 1} ===`);
        
        // Chia mảng ví thành các batch 10 ví
        for (let batchStart = 0; batchStart < MNEMONICS.length; batchStart += 14) {
            const batch = MNEMONICS.slice(batchStart, batchStart + 14);
            console.log(`\n🚀 Chạy batch ví từ ${batchStart + 1} đến ${batchStart + batch.length}`);
            
            // Chạy parallel 10 ví trong batch bằng Promise.all
            await Promise.all(batch.map((mnemonic, index) => 
                processWallet(mnemonic, batchStart + index)
            ));
            
            // Delay giữa các batch để tránh overload RPC
            if (batchStart + 14 < MNEMONICS.length) {
                await delay(10000); // 10 giây giữa batch
            }
        }
    }
}

runBot();
