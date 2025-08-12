import { Storage, Bucket } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";

export class GcsSync {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly remotePath: string;

  constructor(
    bucketName: string,
    remotePath: string = "aep-fee-tracker",
    chain?: string,
  ) {
    this.storage = new Storage();
    this.bucketName = bucketName;
    // If chain is provided, partition by chain: aep-fee-tracker/{chain}
    this.remotePath = chain ? `${remotePath}/${chain}` : remotePath;
  }

  /**
   * Download the entire store directory from GCS to local filesystem
   * Creates local directory structure matching GCS
   */
  async downloadStore(localStorePath: string): Promise<void> {
    console.log(
      `📥 Downloading store from gs://${this.bucketName}/${this.remotePath}/ to ${localStorePath}/`,
    );

    const bucket = this.storage.bucket(this.bucketName);

    try {
      // List all files with the prefix
      const [files] = await bucket.getFiles({ prefix: `${this.remotePath}/` });

      if (files.length === 0) {
        console.log("No existing store found in GCS, starting fresh");
        return;
      }

      // Ensure local directory exists
      if (!fs.existsSync(localStorePath)) {
        fs.mkdirSync(localStorePath, { recursive: true });
      }

      // Download each file
      for (const file of files) {
        const relativePath = file.name.replace(`${this.remotePath}/`, "");
        const localFilePath = path.join(localStorePath, relativePath);

        // Create directory if needed
        const localDir = path.dirname(localFilePath);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        // Download file
        await file.download({ destination: localFilePath });
        console.log(`  ✓ Downloaded: ${relativePath}`);
      }

      console.log(`📥 Store download complete: ${files.length} files`);
    } catch (error) {
      console.error("❌ Error downloading store:", error);
      throw error;
    }
  }

  /**
   * Upload the entire store directory from local filesystem to GCS
   * Overwrites existing files in GCS
   */
  async uploadStore(localStorePath: string): Promise<void> {
    console.log(
      `📤 Uploading store from ${localStorePath}/ to gs://${this.bucketName}/${this.remotePath}/`,
    );

    if (!fs.existsSync(localStorePath)) {
      console.log("No local store directory found, skipping upload");
      return;
    }

    const bucket = this.storage.bucket(this.bucketName);
    let uploadCount = 0;

    try {
      // Recursively upload all files
      uploadCount = await this.uploadDirectory(
        localStorePath,
        localStorePath,
        bucket,
      );
      console.log(`📤 Store upload complete: ${uploadCount} files uploaded`);
    } catch (error) {
      console.error("❌ Error uploading store:", error);
      throw error;
    }
  }

  private async uploadDirectory(
    currentPath: string,
    basePath: string,
    bucket: Bucket,
  ): Promise<number> {
    const items = fs.readdirSync(currentPath);
    let uploadCount = 0;

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        uploadCount += await this.uploadDirectory(fullPath, basePath, bucket);
      } else {
        // Calculate relative path for GCS
        const relativePath = path.relative(basePath, fullPath);
        const gcsPath = `${this.remotePath}/${relativePath.replace(/\\/g, "/")}`;

        // Upload file
        await bucket.upload(fullPath, {
          destination: gcsPath,
          metadata: {
            contentType: fullPath.endsWith(".json")
              ? "application/json"
              : "application/octet-stream",
          },
        });

        console.log(`  ✓ Uploaded: ${relativePath}`);
        uploadCount++;
      }
    }

    return uploadCount;
  }

  /**
   * Check if store exists in GCS
   */
  async storeExists(): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: `${this.remotePath}/`,
        maxResults: 1,
      });
      return files.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get store info for debugging
   */
  async getStoreInfo(): Promise<{ fileCount: number; totalSize: number }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: `${this.remotePath}/` });

      let totalSize = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(String(metadata.size || "0"));
      }

      return {
        fileCount: files.length,
        totalSize,
      };
    } catch (error) {
      console.error("Error getting store info:", error);
      return { fileCount: 0, totalSize: 0 };
    }
  }
}
