import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ExchangeInfo = {
    name: string,
    centralized: boolean,
}

const SKIP_EXCHANGES = [
    'magicsea-v2.1-iota-evm'
]

type VolumeData = {
  date: Date;
  volume: number;
}

const get = async (url: string, params: any = {}) => {
    return await axios.get(
        url,
        {
            headers: {
                'x-cg-pro-api-key': 'CG-padZVjDaFFxvt1x6vSZ1RrTt'
            },
            params,
        },
    )
}

const getExchanges = async () => {
    const perPage = 500; // CoinGecko's max per page
    let page = 1;
    let allExchanges: any[] = [];
    
    while (true) {
        console.log(`Fetching page ${page}...`);
        const data = await get(`https://pro-api.coingecko.com/api/v3/exchanges`, {
            per_page: perPage,
            page: page
        });
        
        const exchanges = data.data;
        
        // If no more exchanges, break the loop
        if (!exchanges || exchanges.length === 0) {
            break;
        }
        
        allExchanges = [...allExchanges, ...exchanges];
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If we got less than perPage results, we've reached the end
        if (exchanges.length < perPage) {
            break;
        }
        
        page++;
    }

    console.log(`Total exchanges fetched: ${allExchanges.length}`);
    return allExchanges;
}

const getEchangeInfo = async (exchange: string): Promise<ExchangeInfo> => {
    const data = await get(`https://pro-api.coingecko.com/api/v3/exchanges/${exchange}`)
    return data.data
}

const getExchangeVolume = async (exchangeId: string): Promise<VolumeData[]> => {
  const days = 365; // For 12 months
  const data = await get(`https://pro-api.coingecko.com/api/v3/exchanges/${exchangeId}/volume_chart`, {
    days: days
  });
  
  return data.data.map(([timestamp, volume]: [number, string]) => ({
    date: new Date(timestamp),
    volume: parseFloat(volume)
  }));
}

async function main(): Promise<void> {
  try {
    const exchangeList = await getExchanges();
    
    for (const ex of exchangeList) {
      if (SKIP_EXCHANGES.includes(ex.id))
        continue

      const existingExchange = await prisma.exchange.findUnique({
        where: { id: ex.id }
      });

      if (!existingExchange) {
        const info = await getEchangeInfo(ex.id);
        await prisma.exchange.create({
            data: {
                id: ex.id,
                name: info.name,
                centralized: info.centralized
            }
        });
        console.log(`Fetched new exchange data: ${ex.id}`);
      } else {
        console.log(`Skipping existing exchange: ${ex.id}`);
      }
    }

    // Fetch all exchanges from database
    const allExchanges = await prisma.exchange.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    console.log('\nAll Exchanges in Database:');
    console.log(`Total count: ${allExchanges.length}`);
    console.table(allExchanges);

    // Fetch and store volumes for each exchange
    for (const exchange of allExchanges) {
      console.log(`Fetching volumes for ${exchange.name}...`);
      
      try {

        const existingExchangeVol = await prisma.volume.findFirst({
          where: { exchangeId: exchange.id }
        });
        if (existingExchangeVol)
          continue

        const volumes = await getExchangeVolume(exchange.id);
        
        // Store volumes in batches
        await prisma.volume.createMany({
          data: volumes.map(v => ({
            exchangeId: exchange.id,
            date: v.date,
            volume: v.volume
          })),
        });

        console.log(`Stored ${volumes.length} volume records for ${exchange.name}`);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch volumes for ${exchange.name}:`, error);
        continue; // Skip to next exchange if this one fails
      }
    }

    // Print summary of volumes stored
    const volumeStats = await prisma.volume.groupBy({
      by: ['exchangeId'],
      _count: {
        volume: true
      }
    });

    console.log('\nVolume Statistics:');
    console.table(volumeStats);

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
    } else {
      console.error('Error:', (error as Error).message || error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function
// main();


getExchangeVolume('binance').then(v => console.log(JSON.stringify(v, null, 2)));