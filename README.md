# Crypto Exchange Volume Analytics

This project fetches and pulls trading volume data for cryptocurrency exchanges, storing it in a SQLite database and provides visualizations.

## Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- TypeScript

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd crypto-exchange-volume
```

2. Install dependencies:

```bash
npm install
```

or 
```bash
yarn install
```


Required packages:

```bash
bash
npm install @prisma/client axios typescript ts-node nodeplotlib date-fns
npm install -D prisma @types/node
```


### Database Setup

1. Initialize Prisma:
```bash
npx prisma init
```


2. Create/update the `.env` file:

```env
DATABASE_URL="file:./dev.db"
```

3. Update the Prisma schema in `prisma/schema.prisma`:

npx prisma migrate dev --name init


4. Run the script to fetch and store data:

```bash
ts-node src/main.ts
```

5. plot the data:

```bash
ts-node src/plot_volumes.ts
ts-node src/plot_dominance.ts
```