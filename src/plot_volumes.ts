import { plot, Plot, Layout } from 'nodeplotlib';
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';
import axios from 'axios';

const prisma = new PrismaClient();

type BTCPrice = {
    [date: string]: number;
};

async function getBTCPrices(): Promise<BTCPrice> {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
            {
                params: {
                    vs_currency: 'usd',
                    days: 365,
                    interval: 'daily'
                },
                headers: {
                    'x-cg-pro-api-key': 'CG-padZVjDaFFxvt1x6vSZ1RrTt'
                }
            }
        );

        const prices: BTCPrice = {};
        response.data.prices.forEach(([timestamp, price]: [number, number]) => {
            const dateStr = format(new Date(timestamp), 'yyyy-MM-dd');
            prices[dateStr] = price;
        });

        return prices;
    } catch (error) {
        console.error('Error fetching BTC prices:', error);
        throw error;
    }
}

async function plotVolumes() {
    try {
        // Fetch BTC prices first
        console.log('Fetching BTC prices...');
        const btcPrices = await getBTCPrices();

        // Fetch all volume data with exchange info
        console.log('Fetching volume data...');
        const volumeData = await prisma.volume.findMany({
            include: {
                exchange: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        // Group data by date and type (centralized/decentralized)
        const dailyVolumes = new Map<string, { 
            centralized: number,
            decentralized: number
        }>();
        
        volumeData.forEach(record => {
            const dateStr = format(record.date, 'yyyy-MM-dd');
            if (!dailyVolumes.has(dateStr)) {
                dailyVolumes.set(dateStr, {
                    centralized: 0,
                    decentralized: 0
                });
            }
            
            const data = dailyVolumes.get(dateStr)!;
            // Convert BTC volume to USD
            const btcPrice = btcPrices[dateStr] || 0;
            const volumeUSD = record.volume * btcPrice;
            
            if (record.exchange.centralized) {
                data.centralized += volumeUSD / 1e9; // Convert to billions
            } else {
                data.decentralized += volumeUSD / 1e9;
            }
        });

        // Convert to arrays for plotting
        const dates = Array.from(dailyVolumes.keys()).sort();
        const centralizedVolumes = dates.map(date => dailyVolumes.get(date)!.centralized);
        const decentralizedVolumes = dates.map(date => dailyVolumes.get(date)!.decentralized);

        // Create plots
        const plots: Plot[] = [
            {
                x: dates,
                y: centralizedVolumes,
                type: 'scatter',
                mode: 'lines',
                name: 'CEX',
                line: { color: 'rgb(31, 119, 180)' }
            },
            {
                x: dates,
                y: decentralizedVolumes,
                type: 'scatter',
                mode: 'lines',
                name: 'DEX',
                line: { color: 'rgb(255, 127, 14)' }
            },
        ];

        const layout: Layout = {
            title: 'Total Daily Trading Volume: Centralized vs Decentralized Exchanges',
            xaxis: {
                title: 'Date',
                tickangle: 45
            },
            yaxis: {
                title: 'Volume (Billion USD)'
            },
            showlegend: true,
            width: 1200,
            height: 800,
            margin: {
                l: 50,
                r: 50,
                b: 100,
                t: 50,
                pad: 4
            }
        };

        // Create the plot
        plot(plots, layout);

        // Calculate and print statistics
        const calculateStats = (volumes: number[]) => {
            const sum = volumes.reduce((a, b) => a + b, 0);
            return {
                average: (sum / volumes.length).toFixed(2),
                total: sum.toFixed(2),
                max: Math.max(...volumes).toFixed(2),
                min: Math.min(...volumes).toFixed(2)
            };
        };

        const cexStats = calculateStats(centralizedVolumes);
        const dexStats = calculateStats(decentralizedVolumes);
        const totalStats = calculateStats(dates.map((_, i) => 
            centralizedVolumes[i] + decentralizedVolumes[i]));

        console.log('\nVolume Statistics (in Billion USD):');
        console.log('\nCentralized Exchanges:');
        console.log(cexStats);
        console.log('\nDecentralized Exchanges:');
        console.log(dexStats);
        console.log('\nTotal:');
        console.log(totalStats);

        // Calculate and print market share
        const cexShare = (Number(cexStats.total) / (Number(cexStats.total) + Number(dexStats.total)) * 100).toFixed(2);
        const dexShare = (Number(dexStats.total) / (Number(cexStats.total) + Number(dexStats.total)) * 100).toFixed(2);
        
        console.log('\nMarket Share:');
        console.log(`Centralized Exchanges: ${cexShare}%`);
        console.log(`Decentralized Exchanges: ${dexShare}%`);

    } catch (error) {
        console.error('Error plotting volumes:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute the plotting function
plotVolumes(); 