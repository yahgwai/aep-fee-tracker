import * as fs from "fs";
import * as path from "path";
import { FileManager } from "../src/infrastructure/storage/file-manager";
import {
  DistributorsData,
  DistributorInfo,
  DistributorType,
} from "../src/types";
import { getAddress } from "ethers";
import { DistributorDetector } from "../src/core/distributor-detection/distributor-detector";
import { JsonRpcProvider } from "ethers";

// Method selectors to distributor types mapping
const METHOD_TO_TYPE: Record<string, DistributorType> = {
  "0x57f585db": DistributorType.L2_BASE_FEE, // setL2BaseFeeCollector
  "0xfcdde2b4": DistributorType.L2_SURPLUS_FEE, // setL2SurplusFeeCollector
  "0x934be07d": DistributorType.L1_SURPLUS_FEE, // setL1SurplusFeeCollector
};

interface RawEvent {
  topics: string[];
  data: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionHash: string;
}

// Parse raw event to extract distributor info
async function parseRawEvent(
  provider: JsonRpcProvider,
  event: RawEvent,
): Promise<DistributorInfo> {
  // Extract method selector from topics[1]
  const methodSelector = event.topics[1]!.substring(0, 10).toLowerCase();

  // Get distributor type from method selector
  const distributorType = METHOD_TO_TYPE[methodSelector];
  if (!distributorType) {
    throw new Error(`Unknown method selector: ${methodSelector}`);
  }

  // Extract distributor address from event data
  // The data field structure:
  // 0x + 64 chars (offset) + 64 chars (length) + 8 chars (method selector) + 64 chars (padded address)
  // The address is in the last 64 chars, with 24 chars of padding (12 bytes) + 40 chars address (20 bytes)
  // Start at position 2 (skip 0x) + 64 + 64 + 8 = 138, skip 24 chars padding, take 40 chars
  const addressHex = "0x" + event.data.substring(162, 202);
  const distributorAddress = getAddress(addressHex);

  // Convert timestamp to date string
  const date = new Date(event.blockTimestamp * 1000);
  const dateString = date.toISOString().split("T")[0];

  // Extract owner from topics[2]
  const ownerData = "0x" + event.topics[2]!.substring(26); // Remove padding from address
  const owner = getAddress(ownerData);

  return {
    type: distributorType,
    block: event.blockNumber,
    date: dateString!,
    tx_hash: event.transactionHash,
    method: methodSelector,
    owner: owner,
    event_data: event.data,
    is_reward_distributor: await DistributorDetector.isRewardDistributor(
      provider,
      distributorAddress,
    ), // Assuming all are reward distributors for this conversion
    distributor_address: distributorAddress,
  };
}

async function main() {
  // Read raw events
  const rawDataPath = path.join(
    __dirname,
    "../__tests__/test-data/distributor-detector/distributor-creation-events-raw.json",
  );
  const rawData = JSON.parse(fs.readFileSync(rawDataPath, "utf-8"));

  // Initialize FileManager with store directory
  const storeDir = path.join(__dirname, "../mytestdata");
  const fileManager = new FileManager(storeDir);

  // Convert events to DistributorsData format
  const distributorsData: DistributorsData = {
    metadata: {
      chain_id: rawData.metadata.chain_id,
      arbowner_address: rawData.metadata.arbowner_address,
      last_scanned_block: Math.max(
        ...rawData.events.map((e: RawEvent) => e.blockNumber),
      ),
    },
    distributors: {},
  };

  // Process each event in chronological order
  // Sort events by block number to ensure proper ordering
  const sortedEvents = [...rawData.events].sort(
    (a, b) => a.blockNumber - b.blockNumber,
  );

  const provider = new JsonRpcProvider("https://nova.arbitrum.io/rpc");

  for (const event of sortedEvents) {
    try {
      const distributorInfo = await parseRawEvent(provider, event);

      // Check if this distributor already exists
      const existingInfo =
        distributorsData.distributors[distributorInfo.distributor_address];
      if (existingInfo) {
        // If duplicate, prefer L2_SURPLUS_FEE type
        if (existingInfo.type === DistributorType.L2_SURPLUS_FEE) {
          console.log(
            `Keeping distributor: ${distributorInfo.distributor_address} as ${existingInfo.type} (skipping ${distributorInfo.type})`,
          );
          continue; // Skip this event, keep the existing L2_SURPLUS_FEE
        } else if (distributorInfo.type === DistributorType.L2_SURPLUS_FEE) {
          console.log(
            `Updating distributor: ${distributorInfo.distributor_address} from ${existingInfo.type} to ${distributorInfo.type}`,
          );
          distributorsData.distributors[distributorInfo.distributor_address] =
            distributorInfo;
        } else {
          console.log(
            `Keeping distributor: ${distributorInfo.distributor_address} as ${existingInfo.type} (skipping ${distributorInfo.type})`,
          );
          continue; // Keep the first one if neither is L2_SURPLUS_FEE
        }
      } else {
        console.log(
          `New distributor: ${distributorInfo.distributor_address} (${distributorInfo.type})`,
        );
        distributorsData.distributors[distributorInfo.distributor_address] =
          distributorInfo;
      }
    } catch (error) {
      console.error(
        `Failed to parse event at block ${event.blockNumber}:`,
        error,
      );
    }
  }

  // Write to file using FileManager
  fileManager.writeDistributors(distributorsData);

  console.log(
    `\nSuccessfully converted ${Object.keys(distributorsData.distributors).length} distributors`,
  );
  console.log(`Data written to: ${path.join(storeDir, "distributors.json")}`);
}

// Run the script
main().catch(console.error);
