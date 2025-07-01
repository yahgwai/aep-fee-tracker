#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== 'dist' && item !== 'coverage' && item !== '.git') {
        files.push(...findTestFiles(fullPath));
      }
    } else if (item.endsWith('.test.ts') || item.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixDistributorAssignments(content) {
  let modified = false;
  let newContent = content;
  
  // Fix patterns like: distributors.distributors[addr1] = { ... }
  // to: distributors.distributors[addr1] = [{ ... }]
  const assignmentPattern = /distributors\.distributors\[([^\]]+)\]\s*=\s*\{([^}]+)\}/g;
  
  let match;
  const replacements = [];
  
  while ((match = assignmentPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const variable = match[1];
    const objectContent = match[2];
    
    // Check if it's already an array
    if (!fullMatch.includes('[{')) {
      replacements.push({
        from: fullMatch,
        to: `distributors.distributors[${variable}] = [{${objectContent}}]`
      });
    }
  }
  
  // Apply replacements
  for (const replacement of replacements) {
    newContent = newContent.replace(replacement.from, replacement.to);
    modified = true;
  }
  
  // Fix patterns in object literals
  // From: distributors: { "0xAddr": { type: ... } }
  // To: distributors: { "0xAddr": [{ type: ... }] }
  const objectLiteralPattern = /distributors:\s*\{([^}]*?["'][0-9a-fA-Fx]+["']:\s*)\{([^}]+)\}([^}]*)\}/g;
  
  newContent = newContent.replace(objectLiteralPattern, (match, prefix, content, suffix) => {
    // Check if it's already an array
    if (!prefix.includes('[{')) {
      return `distributors: {${prefix}[{${content}}]${suffix}}`;
    }
    return match;
  });
  
  if (newContent !== content) {
    modified = true;
  }
  
  // Fix property access patterns
  // From: distributors[address].property
  // To: distributors[address][0].property
  const accessPatterns = [
    /distributors\[([^\]]+)\]\.is_reward_distributor/g,
    /distributors\[([^\]]+)\]\.type/g,
    /distributors\[([^\]]+)\]\.date/g,
    /distributors\[([^\]]+)\]\.block/g,
    /distributors\[([^\]]+)\]\?\.is_reward_distributor/g,
    /distributors\[([^\]]+)\]\?\.type/g,
    /distributors\[([^\]]+)\]\?\.date/g,
    /distributors\[([^\]]+)\]\?\.block/g,
  ];
  
  for (const pattern of accessPatterns) {
    newContent = newContent.replace(pattern, (match, address) => {
      // Check if [0] is already there
      if (!match.includes('[0]')) {
        const optional = match.includes('?.') ? '?.' : '.';
        const property = match.split(optional)[1];
        return `distributors[${address}]${optional}[0]${optional}${property}`;
      }
      return match;
    });
  }
  
  if (newContent !== content) {
    modified = true;
  }
  
  return { content: newContent, modified };
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { content: newContent, modified } = fixDistributorAssignments(content);
    
    if (modified) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`  ${colors.green}✓ Fixed distributor patterns${colors.reset}`);
      return true;
    } else {
      console.log(`  ${colors.green}✓ No changes needed${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`  ${colors.red}✗ Error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Main execution
console.log(`${colors.cyan}=== Distributor Test Fix Script ===${colors.reset}\n`);

const testFiles = findTestFiles(path.join(__dirname, '..', '__tests__'));
console.log(`Found ${testFiles.length} test files to process\n`);

let modifiedCount = 0;

for (const file of testFiles) {
  const relativePath = path.relative(process.cwd(), file);
  console.log(`${colors.yellow}Processing: ${relativePath}${colors.reset}`);
  
  if (processFile(file)) {
    modifiedCount++;
  }
}

console.log(`\n${colors.cyan}=== Summary ===${colors.reset}`);
console.log(`Files processed: ${testFiles.length}`);
console.log(`Files modified: ${modifiedCount}`);

if (modifiedCount > 0) {
  console.log(`\n${colors.green}Successfully fixed distributor patterns in ${modifiedCount} files.${colors.reset}`);
} else {
  console.log(`\n${colors.yellow}No files needed fixing.${colors.reset}`);
}