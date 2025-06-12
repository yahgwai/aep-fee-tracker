import * as fs from "fs";
import { getAddress } from "ethers";
import {
  FileManager as FileManagerInterface,
  Address,
  DateString,
  BlockNumberData,
  DistributorsData,
  BalanceData,
  OutflowData,
} from "./types";

export class FileManager implements FileManagerInterface {
  constructor() {}

  async readBlockNumbers(): Promise<BlockNumberData> {
    throw new Error("Not implemented");
  }

  async writeBlockNumbers(data: BlockNumberData): Promise<void> {
    void data;
    throw new Error("Not implemented");
  }

  async readDistributors(): Promise<DistributorsData> {
    throw new Error("Not implemented");
  }

  async writeDistributors(data: DistributorsData): Promise<void> {
    void data;
    throw new Error("Not implemented");
  }

  async readDistributorBalances(address: Address): Promise<BalanceData> {
    void address;
    throw new Error("Not implemented");
  }

  async writeDistributorBalances(
    address: Address,
    data: BalanceData,
  ): Promise<void> {
    void address;
    void data;
    throw new Error("Not implemented");
  }

  async readDistributorOutflows(address: Address): Promise<OutflowData> {
    void address;
    throw new Error("Not implemented");
  }

  async writeDistributorOutflows(
    address: Address,
    data: OutflowData,
  ): Promise<void> {
    void address;
    void data;
    throw new Error("Not implemented");
  }

  async ensureStoreDirectory(): Promise<void> {
    if (!fs.existsSync("store")) {
      fs.mkdirSync("store", { recursive: true });
    }
  }

  validateAddress(address: string): Address {
    if (!address.startsWith("0x")) {
      throw new Error("Invalid address");
    }
    try {
      return getAddress(address);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes("bad address checksum")
      ) {
        throw new Error("bad address checksum");
      }
      throw new Error("Invalid address");
    }
  }

  formatDate(date: Date): DateString {
    const isoString = date.toISOString();
    const datePart = isoString.split("T")[0];
    return datePart as DateString;
  }
}
