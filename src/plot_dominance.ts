import { plot, Plot, Layout } from 'nodeplotlib';
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient();

async function plotDominance() {
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

        // Group data by date and calculate dominance
        const dailyDominance = new Map<string, {
            centralizedVolume: number,
            totalVolume: number,
            dominance: number
        }>();
        
        volumeData.forEach(record => {
            const dateStr = format(record.date, 'yyyy-MM-dd');
            if (!dailyDominance.has(dateStr)) {
                dailyDominance.set(dateStr, {
                    centralizedVolume: 0,
                    totalVolume: 0,
                    dominance: 0
                });
            }
            
            const data = dailyDominance.get(dateStr)!;
            if (record.exchange.centralized) {
                data.centralizedVolume += record.volume;
            }
            data.totalVolume += record.volume;
        });

        // Calculate dominance percentage
        dailyDominance.forEach(data => {
            data.dominance = (data.centralizedVolume / data.totalVolume) * 100;
        });

        // Convert to arrays for plotting
        const dates = Array.from(dailyDominance.keys()).sort();
        const dominanceValues = dates.map(date => dailyDominance.get(date)!.dominance);

        // Create plot
        const plots: Plot[] = [
            {
                x: dates,
                // y: dominanceValues,
                y: dominanceValues.map(v => 100),
                type: 'scatter',
                mode: 'lines',
                name: 'CEX',
                line: { 
                    color: 'rgb(31, 119, 180)',
                    width: 2
                },
                fill: 'tozeroy'  // Add area fill
            },
            {
                x: dates,
                y: dominanceValues.map(v => 100 - v),
                type: 'scatter',
                mode: 'lines',
                name: 'DEX',
                line: { 
                    // color: 'rgb(31, 119, 180)',
                    width: 2
                },
                fill: 'tozeroy'  // Add area fill
            }
        ];

        const layout: Layout = {
            title: 'Centralized Exchange Market Dominance Over Time',
            xaxis: {
                title: 'Date',
                tickangle: 45
            },
            yaxis: {
                title: 'Total Volume (%)',
                range: [0, 100],  // Fix y-axis range from 0 to 100%
                ticksuffix: '%'
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
            },
            shapes: [{  // Add 50% reference line
                type: 'line',
                x0: dates[0],
                x1: dates[dates.length - 1],
                y0: 50,
                y1: 50,
                line: {
                    color: 'red',
                    width: 1,
                    dash: 'dash'
                }
            }]
        };

        // Create the plot
        plot(plots, layout);

        // Calculate and print statistics
        const stats = {
            currentDominance: dominanceValues[dominanceValues.length - 1].toFixed(2),
            averageDominance: (dominanceValues.reduce((a, b) => a + b, 0) / dominanceValues.length).toFixed(2),
            maxDominance: Math.max(...dominanceValues).toFixed(2),
            minDominance: Math.min(...dominanceValues).toFixed(2),
            volatility: calculateVolatility(dominanceValues).toFixed(2)
        };

        console.log('\nCEX Dominance Statistics (%):');
        console.log('Current Dominance:', stats.currentDominance + '%');
        console.log('Average Dominance:', stats.averageDominance + '%');
        console.log('Maximum Dominance:', stats.maxDominance + '%');
        console.log('Minimum Dominance:', stats.minDominance + '%');
        console.log('Volatility:', stats.volatility + '%');
    } catch (error) {
        console.error('Error plotting dominance:', error);
    }
}

function calculateVolatility(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

plotDominance(); 