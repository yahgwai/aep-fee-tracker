#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// Counter for changes
let filesProcessed = 0;
let filesModified = 0;
let totalReplacements = 0;

/**
 * Find all test files
 */
function findTestFiles() {
  const patterns = [
    '**/*.test.ts',
    '**/*.test.js',
    '**/*.spec.ts',
    '**/*.spec.js'
  ];
  
  const excludePatterns = [
    'node_modules/**',
    'dist/**',
    'build/**',
    '.git/**'
  ];
  
  let files = [];
  for (const pattern of patterns) {
    const found = glob.sync(pattern, {
      ignore: excludePatterns,
      cwd: process.cwd()
    });
    files = files.concat(found);
  }
  
  return files;
}

/**
 * Check if a line contains the old distributor format
 */
function containsOldDistributorFormat(content) {
  // Pattern to match distributors: { "0xAddress": { type: ..., ... } }
  const oldFormatRegex = /distributors:\s*\{[^}]*["']0x[A-Fa-f0-9]+["']\s*:\s*\{[^}]*type:\s*DistributorType\.[A-Z_]+/;
  return oldFormatRegex.test(content);
}

/**
 * Convert old distributor format to new array format
 */
function migrateDistributorFormat(content, filePath) {
  let modifiedContent = content;
  let replacementCount = 0;

  // Pattern 1: Convert distributor object definitions from object to array
  // This needs to handle multi-line objects with proper brace matching
  // Matches patterns like:
  // "0xAddress": {
  //   type: DistributorType.L2_BASE_FEE,
  //   ...
  // }
  // 
  // And converts to:
  // "0xAddress": [{
  //   type: DistributorType.L2_BASE_FEE,
  //   ...
  // }]
  
  // More robust regex that handles multi-line objects
  function convertDistributorObjects(text) {
    let result = text;
    let hasChanges = true;
    
    while (hasChanges) {
      hasChanges = false;
      
      // Look for distributor object patterns
      result = result.replace(/(["']0x[A-Fa-f0-9]+["']\s*:\s*)(\{(?:[^{}]|\{[^{}]*\})*\})(,?)(\s*(?:\/\/.*)?)/g, (match, addressPart, objectPart, comma, trailing) => {
        // Check if this is actually a distributor object (has type: DistributorType)
        // and is NOT already an array
        if (objectPart.includes('type:') && objectPart.includes('DistributorType') && !match.includes('[{')) {
          replacementCount++;
          hasChanges = true;
          console.log(`${colors.cyan}  Converting distributor object to array format${colors.reset}`);
          return `${addressPart}[${objectPart}]${comma}${trailing}`;
        }
        return match;
      });
    }
    
    return result;
  }
  
  modifiedContent = convertDistributorObjects(modifiedContent);

  // Pattern 2: Update property access from distributors[address].property to distributors[address][0].property
  // This handles cases like:
  // - distributors[address].is_reward_distributor
  // - distributors["0xAddress"].type
  // - distributors[someVariable].block
  
  const propertyAccessRegex = /distributors\[([^\]]+)\]\.([a-zA-Z_]+)/g;
  
  modifiedContent = modifiedContent.replace(propertyAccessRegex, (match, addressExpr, property) => {
    // Common distributor properties that need migration
    const distributorProperties = [
      'type', 'block', 'date', 'tx_hash', 'method', 'owner', 
      'event_data', 'is_reward_distributor', 'distributor_address'
    ];
    
    if (distributorProperties.includes(property)) {
      replacementCount++;
      console.log(`${colors.cyan}  Converting property access: ${property}${colors.reset}`);
      return `distributors[${addressExpr}][0].${property}`;
    }
    return match;
  });

  // Pattern 3: Handle direct property access with string literals
  // e.g., distributors["0x1234..."].is_reward_distributor
  const directAccessRegex = /distributors\s*\.\s*(["']0x[A-Fa-f0-9]+["'])\s*\.([a-zA-Z_]+)/g;
  
  modifiedContent = modifiedContent.replace(directAccessRegex, (match, address, property) => {
    const distributorProperties = [
      'type', 'block', 'date', 'tx_hash', 'method', 'owner', 
      'event_data', 'is_reward_distributor', 'distributor_address'
    ];
    
    if (distributorProperties.includes(property)) {
      replacementCount++;
      console.log(`${colors.cyan}  Converting direct property access: ${property}${colors.reset}`);
      return `distributors[${address}][0].${property}`;
    }
    return match;
  });

  // Pattern 4: Handle mockDistributorsData and similar test data structures
  // Look for patterns in mock data definitions
  const mockDataRegex = /(\w+\.distributors\s*=\s*\{[^}]*)(["']0x[A-Fa-f0-9]+["']\s*:\s*)(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
  
  modifiedContent = modifiedContent.replace(mockDataRegex, (match, prefix, addressPart, objectPart) => {
    if (objectPart.includes('type:') && objectPart.includes('DistributorType')) {
      replacementCount++;
      console.log(`${colors.cyan}  Converting mock data distributor object${colors.reset}`);
      return `${prefix}${addressPart}[${objectPart}]`;
    }
    return match;
  });

  totalReplacements += replacementCount;
  return { modifiedContent, replacementCount };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  filesProcessed++;
  
  console.log(`${colors.yellow}Processing: ${filePath}${colors.reset}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file contains old distributor format
    if (!containsOldDistributorFormat(content)) {
      console.log(`  ${colors.green}✓ No old distributor format found${colors.reset}`);
      return;
    }
    
    // Migrate the content
    const { modifiedContent, replacementCount } = migrateDistributorFormat(content, filePath);
    
    if (replacementCount > 0) {
      // Write the modified content back
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      filesModified++;
      console.log(`  ${colors.green}✓ Modified with ${replacementCount} replacements${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠ Pattern detected but no replacements made${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`  ${colors.red}✗ Error processing file: ${error.message}${colors.reset}`);
  }
}

/**
 * Main function
 */
function main() {
  console.log(`${colors.cyan}=== Distributor Test Migration Script ===${colors.reset}\n`);
  
  const testFiles = findTestFiles();
  console.log(`Found ${testFiles.length} test files to process\n`);
  
  if (testFiles.length === 0) {
    console.log(`${colors.yellow}No test files found!${colors.reset}`);
    return;
  }
  
  // Process each file
  testFiles.forEach(processFile);
  
  // Summary
  console.log(`\n${colors.cyan}=== Migration Summary ===${colors.reset}`);
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalReplacements}`);
  
  if (filesModified > 0) {
    console.log(`\n${colors.green}✓ Migration completed successfully!${colors.reset}`);
    console.log(`${colors.yellow}Please review the changes and run your tests to ensure everything works correctly.${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}No files needed migration.${colors.reset}`);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { migrateDistributorFormat, findTestFiles };