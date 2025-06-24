import { ethers } from "ethers";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

interface RecipientRecievedEvent {
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  recipient: string;
  value: string;
}

interface RecipientRecievedTestData {
  chain_id: number;
  distributor_address: string;
  events: RecipientRecievedEvent[];
  block_range: {
    start: number;
    end: number;
  };
}

const NOVA_RPC_URL = "https://nova.arbitrum.io/rpc";
const DISTRIBUTOR_ADDRESSES = [
  "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
  "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
  "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
  "0x9fCB6F75D99029f28F6F4a1d277bae49c5CAC79f",
  "0xdff90519a9DE6ad469D4f9839a9220C5D340B792",
];

const OUTPUT_DIR = join(__dirname, "../__tests__/test-data/recipient-recieved");

async function gatherEvents() {
  console.log("🔍 Gathering RecipientRecieved events from Nova Arbitrum...");

  const provider = new ethers.JsonRpcProvider(NOVA_RPC_URL);
  const chainId = Number(await provider.getNetwork().then((n) => n.chainId));
  console.log(`✅ Connected to chain ${chainId}`);

  if (chainId !== 42170) {
    throw new Error(`Expected Nova Arbitrum (42170), got ${chainId}`);
  }

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // RecipientRecieved event signature
  const eventSignature = ethers.id("RecipientRecieved(address,uint256)");
  console.log(`📝 Event signature: ${eventSignature}`);

  // Create interface for decoding
  const iface = new ethers.Interface([
    "event RecipientRecieved(address indexed recipient, uint256 value)",
  ]);

  let totalEventsFound = 0;
  const successfulDistributors: string[] = [];

  for (const distributorAddress of DISTRIBUTOR_ADDRESSES) {
    console.log(`\n🏦 Processing distributor: ${distributorAddress}`);

    try {
      // Get creation block from balance data
      const balanceDataPath = join(
        __dirname,
        `../__tests__/test-data/distributor-detector/balance_data/${distributorAddress}/balances.json`,
      );

      if (!existsSync(balanceDataPath)) {
        console.log(
          `⚠️  No balance data found for ${distributorAddress}, skipping...`,
        );
        continue;
      }

      const balanceData = JSON.parse(readFileSync(balanceDataPath, "utf-8"));
      const dates = Object.keys(balanceData.balances).sort();
      const firstDate = dates[0];
      const firstBlock = balanceData.balances[firstDate].block_number;

      console.log(`📅 First balance date: ${firstDate}, block: ${firstBlock}`);

      // Get current block - scan recent blocks where events are more likely
      const currentBlock = await provider.getBlockNumber();

      // Start from a more recent block (last 1 million blocks for faster testing)
      const recentStartBlock = Math.min(currentBlock, firstBlock);
      const endBlock = currentBlock;

      console.log(
        `🔍 Scanning recent blocks ${recentStartBlock} to ${endBlock}`,
      );
      console.log(`   (Full range would be ${firstBlock} to ${currentBlock})`);

      // Search for events in chunks
      const events: RecipientRecievedEvent[] = [];
      const chunkSize = 100000000; // Bigger chunks for recent blocks
      let minBlock = Infinity;
      let maxBlock = -Infinity;
      let processedBlocks = 0;

      for (
        let fromBlock = recentStartBlock;
        fromBlock < endBlock;
        fromBlock += chunkSize
      ) {
        const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock);
        processedBlocks = toBlock - recentStartBlock;

        // Show progress every 50k blocks
        // if (processedBlocks % 1000000 === 0 && processedBlocks > 0) {
        const progress = (
          (processedBlocks / (endBlock - recentStartBlock)) *
          100
        ).toFixed(1);
        console.log(
          `   Progress: ${progress}% (${processedBlocks} blocks scanned)`,
        );
        // }

        try {
          const filter = {
            address: distributorAddress,
            topics: [eventSignature],
            fromBlock,
            toBlock,
          };

          const logs = await provider.getLogs(filter);

          if (logs.length > 0) {
            console.log(
              `   Found ${logs.length} events in blocks ${fromBlock}-${toBlock}`,
            );

            for (const log of logs) {
              const decoded = iface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });

              if (!decoded) continue;

              const event: RecipientRecievedEvent = {
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                logIndex: log.index,
                address: log.address,
                topics: log.topics as string[],
                data: log.data,
                recipient: ethers.getAddress(decoded.args.recipient),
                value: decoded.args.value.toString(),
              };

              events.push(event);
              minBlock = Math.min(minBlock, log.blockNumber);
              maxBlock = Math.max(maxBlock, log.blockNumber);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("rate limit")) {
            console.log(`   Rate limited, waiting 5 seconds...`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            fromBlock -= chunkSize; // Retry this chunk
          } else {
            console.log(`   Error in chunk ${fromBlock}-${toBlock}:`, error);
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (events.length > 0) {
        const testData: RecipientRecievedTestData = {
          chain_id: 42170,
          distributor_address: distributorAddress,
          events: events.sort((a, b) => a.blockNumber - b.blockNumber),
          block_range: {
            start: minBlock,
            end: maxBlock,
          },
        };

        const outputPath = join(OUTPUT_DIR, `${distributorAddress}.json`);
        writeFileSync(outputPath, JSON.stringify(testData, null, 2));

        console.log(
          `✅ Found ${events.length} events for ${distributorAddress}`,
        );
        console.log(`   Block range: ${minBlock} - ${maxBlock}`);
        console.log(`   Saved to: ${outputPath}`);

        totalEventsFound += events.length;
        successfulDistributors.push(distributorAddress);

        // Show sample event
        if (events.length > 0) {
          const sample = events[0];
          console.log(`   Sample event:`);
          console.log(`     - Recipient: ${sample.recipient}`);
          console.log(`     - Value: ${ethers.formatEther(sample.value)} ETH`);
          console.log(`     - Tx: ${sample.transactionHash}`);
        }
      } else {
        console.log(`❌ No events found for ${distributorAddress}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${distributorAddress}:`, error);
    }
  }

  // Create README
  const readmePath = join(OUTPUT_DIR, "README.md");
  const readmeContent = `# RecipientRecieved Event Test Data

This directory contains real blockchain data for RecipientRecieved events from Nova Arbitrum reward distributors.

## Data Structure

Each JSON file is named after the distributor address and contains:

\`\`\`typescript
{
  "chain_id": 42170,              // Nova Arbitrum chain ID
  "distributor_address": "0x...", // The distributor contract address
  "events": [                     // Array of RecipientRecieved events
    {
      "blockNumber": 12345,
      "transactionHash": "0x...",
      "logIndex": 0,
      "address": "0x...",         // Contract that emitted the event
      "topics": ["0x..."],        // Event topics (signature + indexed params)
      "data": "0x...",           // Non-indexed event data
      "recipient": "0x...",      // Parsed recipient address (checksummed)
      "value": "1000000..."      // Parsed value in wei (decimal string)
    }
  ],
  "block_range": {
    "start": 12345,              // First block with events
    "end": 67890                 // Last block with events
  }
}
\`\`\`

## Summary

- Total distributors scanned: ${DISTRIBUTOR_ADDRESSES.length}
- Distributors with events: ${successfulDistributors.length}
- Total events found: ${totalEventsFound}

## Distributors with Events

${successfulDistributors.map((addr) => `- ${addr}`).join("\n")}

## Data Collection

Data was collected on ${new Date().toISOString()} from Nova Arbitrum RPC.
`;

  writeFileSync(readmePath, readmeContent);

  console.log(`\n✅ Data collection complete!`);
  console.log(`   Total events: ${totalEventsFound}`);
  console.log(
    `   Successful distributors: ${successfulDistributors.length}/${DISTRIBUTOR_ADDRESSES.length}`,
  );
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

// Run the script
gatherEvents().catch(console.error);
