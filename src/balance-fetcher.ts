import { ethers } from "ethers";
import { withRetry, FileManager, BlockNumberData, BalanceData } from "./types";

interface RawEvent {
  data: string;
}

export class BalanceFetcher {
  static parseDistributorAddresses(events: RawEvent[]): string[] {
    const addresses: string[] = [];

    for (const event of events) {
      if (event.data && event.data.length > 138) {
        try {
          // Skip: 0x (2) + offset (64) + length (64) + method selector (8) = 138 chars
          const encodedAddress = "0x" + event.data.substring(138);
          const [distributorAddress] = ethers.AbiCoder.defaultAbiCoder().decode(
            ["address"],
            encodedAddress,
          );
          addresses.push(ethers.getAddress(distributorAddress));
        } catch {
          // Skip events that cannot be parsed
        }
      }
    }

    return addresses;
  }

  static async fetchBalance(
    provider: ethers.Provider,
    address: string,
    blockNumber: number,
  ): Promise<string> {
    const balance = await withRetry(
      () => provider.getBalance(address, blockNumber),
      {
        maxRetries: 3,
        operationName: `fetchBalance(${address}, ${blockNumber})`,
      },
    );
    return balance.toString();
  }

  static async fetchBalancesForDistributor(
    provider: ethers.Provider,
    address: string,
    blockNumbers: number[],
  ): Promise<Record<string, string>> {
    const balancePromises = blockNumbers.map(async (blockNumber) => ({
      blockNumber: blockNumber.toString(),
      balance: await this.fetchBalance(provider, address, blockNumber),
    }));

    const results = await Promise.all(balancePromises);

    return results.reduce(
      (acc, { blockNumber, balance }) => {
        acc[blockNumber] = balance;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  static async fetchAllDistributorBalances(
    provider: ethers.Provider,
    addresses: string[],
    blockNumbers: number[],
  ): Promise<Record<string, Record<string, string>>> {
    const distributorPromises = addresses.map(async (address) => ({
      address,
      balances: await this.fetchBalancesForDistributor(
        provider,
        address,
        blockNumbers,
      ),
    }));

    const results = await Promise.all(distributorPromises);

    return results.reduce(
      (acc, { address, balances }) => {
        acc[address] = balances;
        return acc;
      },
      {} as Record<string, Record<string, string>>,
    );
  }

  static async saveBalanceData(
    fileManager: FileManager,
    balanceData: Record<string, Record<string, string>>,
    blockNumbersData: BlockNumberData,
  ): Promise<void> {
    const blockToDate = Object.entries(blockNumbersData.blocks).reduce(
      (acc, [date, block]) => {
        acc[block.toString()] = date;
        return acc;
      },
      {} as Record<string, string>,
    );

    for (const [address, blockBalances] of Object.entries(balanceData)) {
      const balanceDataForAddress: BalanceData = {
        metadata: {
          chain_id: blockNumbersData.metadata.chain_id,
          reward_distributor: address,
        },
        balances: {},
      };

      for (const [blockNumber, balance] of Object.entries(blockBalances)) {
        const date = blockToDate[blockNumber];
        if (date) {
          balanceDataForAddress.balances[date] = {
            block_number: parseInt(blockNumber),
            balance_wei: balance,
          };
        }
      }

      if (Object.keys(balanceDataForAddress.balances).length > 0) {
        fileManager.writeDistributorBalances(address, balanceDataForAddress);
      }
    }
  }
}
