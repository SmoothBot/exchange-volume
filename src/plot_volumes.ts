import { plot, Plot, Layout } from 'nodeplotlib';
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient();

async function plotVolumes() {
    try {
        // Fetch all volume data with exchange info
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
            if (record.exchange.centralized) {
                data.centralized += record.volume / 1e9; // Convert to billions
            } else {
                data.decentralized += record.volume / 1e9;
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
                name: 'Centralized Exchanges',
                line: { color: 'rgb(31, 119, 180)' }
            },
            {
                x: dates,
                y: decentralizedVolumes,
                type: 'scatter',
                mode: 'lines',
                name: 'Decentralized Exchanges',
                line: { color: 'rgb(255, 127, 14)' }
            },
            // {
            //     x: dates,
            //     y: dates.map((_, i) => centralizedVolumes[i] + decentralizedVolumes[i]),
            //     type: 'scatter',
            //     mode: 'lines',
            //     name: 'Total Volume',
            //     line: { 
            //         color: 'rgb(44, 160, 44)',
            //         dash: 'dot'
            //     }
            // }
        ];

        const layout: Layout = {
            title: 'Daily Trading Volume: Centralized vs Decentralized Exchanges',
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
                average: sum / volumes.length,
                total: sum,
                max: Math.max(...volumes),
                min: Math.min(...volumes)
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
        const cexShare = (cexStats.total / (cexStats.total + dexStats.total) * 100).toFixed(2);
        const dexShare = (dexStats.total / (cexStats.total + dexStats.total) * 100).toFixed(2);
        
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