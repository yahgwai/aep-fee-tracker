import { ethers } from "ethers";
import { writeFileSync, mkdirSync } from "fs";
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

const OUTPUT_DIR = join(__dirname, "../__tests__/test-data/recipient-recieved");

// Create realistic mock data based on expected patterns
function createMockEvents() {
  console.log("📝 Creating mock RecipientRecieved event data for testing...");

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // RecipientRecieved event signature
  const eventSignature = ethers.id("RecipientRecieved(address,uint256)");

  // Mock recipients (properly checksummed)
  const mockRecipients = [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
  ];

  // Create mock data for first 3 distributors
  const distributors = [
    {
      address: "0x37daA99b1cAAE0c22670963e103a66CA2c5dB2dB",
      startBlock: 75000000,
      eventCount: 15,
    },
    {
      address: "0x3B68a689c929327224dBfCe31C1bf72Ffd2559Ce",
      startBlock: 76000000,
      eventCount: 8,
    },
    {
      address: "0x509386DbF5C0BE6fd68Df97A05fdB375136c32De",
      startBlock: 77000000,
      eventCount: 12,
    },
  ];

  let totalEvents = 0;

  distributors.forEach(
    ({ address: distributorAddress, startBlock, eventCount }) => {
      const events: RecipientRecievedEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        const blockNumber = startBlock + Math.floor(Math.random() * 1000000);
        const recipient = mockRecipients[i % mockRecipients.length];

        // Create varied values (small to large)
        const valueMultiplier = i % 3 === 0 ? 1000 : i % 3 === 1 ? 10 : 1;
        const baseValue = ethers.parseEther((Math.random() * 10).toFixed(6));
        const value = baseValue * BigInt(valueMultiplier);

        // Encode the recipient address for topics[1]
        const recipientTopic = ethers.zeroPadValue(recipient, 32);

        // Create the event
        const event: RecipientRecievedEvent = {
          blockNumber,
          transactionHash: ethers.hexlify(ethers.randomBytes(32)),
          logIndex: i % 3,
          address: distributorAddress,
          topics: [eventSignature, recipientTopic],
          data: ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [value]),
          recipient: ethers.getAddress(recipient),
          value: value.toString(),
        };

        events.push(event);
      }

      // Sort events by block number
      events.sort((a, b) => a.blockNumber - b.blockNumber);

      const testData: RecipientRecievedTestData = {
        chain_id: 42170,
        distributor_address: distributorAddress,
        events,
        block_range: {
          start: events[0].blockNumber,
          end: events[events.length - 1].blockNumber,
        },
      };

      const outputPath = join(OUTPUT_DIR, `${distributorAddress}.json`);
      writeFileSync(outputPath, JSON.stringify(testData, null, 2));

      console.log(
        `✅ Created ${events.length} mock events for ${distributorAddress}`,
      );
      console.log(
        `   Block range: ${testData.block_range.start} - ${testData.block_range.end}`,
      );
      console.log(
        `   Sample value: ${ethers.formatEther(events[0].value)} ETH`,
      );

      totalEvents += events.length;
    },
  );

  // Create README
  const readmePath = join(OUTPUT_DIR, "README.md");
  const readmeContent = `# RecipientRecieved Event Test Data

This directory contains test data for RecipientRecieved events from Nova Arbitrum reward distributors.

## ⚠️ Mock Data Notice

Due to rate limiting on the public Nova Arbitrum RPC endpoint, this directory currently contains **mock data** that follows the expected structure of real RecipientRecieved events. The mock data is realistic and suitable for testing the scanner implementation.

To gather real data, you would need:
1. Access to a Nova Arbitrum archive node without rate limits
2. Or a paid RPC service with higher rate limits
3. Or implement patient retry logic that respects rate limits (could take hours/days)

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

- Total distributors: 3
- Total mock events: ${totalEvents}
- Event signature: ${eventSignature}

## Mock Data Characteristics

The mock data includes:
- Events spanning multiple blocks
- Various recipient addresses
- Both small and large value transfers (1x, 10x, 1000x multipliers)
- Proper event encoding following Ethereum standards
- Checksummed addresses

## Future Work

To replace with real data:
1. Obtain access to a reliable Nova Arbitrum RPC endpoint
2. Run \`scripts/gather-recipient-recieved-events.ts\` with proper rate limiting
3. Verify the actual event signature matches our expectation
4. Update this README with real data statistics
`;

  writeFileSync(readmePath, readmeContent);

  console.log(`\n✅ Mock data creation complete!`);
  console.log(`   Total events: ${totalEvents}`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

// Run the script
createMockEvents();
