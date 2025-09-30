import * as fs from "fs";

interface AssertionResult {
  title: string;
  fullName: string;
  status: string;
  duration?: number;
}

interface TestSuiteResult {
  name: string;
  startTime: number;
  endTime: number;
  status: string;
  assertionResults: AssertionResult[];
}

interface JestTestResults {
  numTotalTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: TestSuiteResult[];
}

interface TestSuite {
  name: string;
  duration: number;
  numTests: number;
  status: string;
}

// Default to test-results folder, or accept path as argument
const resultsPath = process.argv[2] || "test-results/test-results.json";

if (!fs.existsSync(resultsPath)) {
  console.error(`Error: Test results file not found at ${resultsPath}`);
  console.error(
    "Run: npm test -- --json --outputFile=test-results/test-results.json",
  );
  process.exit(1);
}

console.log(`\n📊 Test results loaded from: ${resultsPath}`);

// Read the test results JSON file
const testResults: JestTestResults = JSON.parse(
  fs.readFileSync(resultsPath, "utf8"),
);

// Extract test suites with their timing
const suites: TestSuite[] = testResults.testResults.map((suite) => ({
  name: suite.name.replace("/workspace/", ""),
  duration: suite.endTime - suite.startTime,
  numTests: suite.assertionResults ? suite.assertionResults.length : 0,
  status: suite.status,
}));

// Sort by duration (longest first)
suites.sort((a, b) => b.duration - a.duration);

console.log("\n=== TEST SUITE TIMINGS (longest first) ===\n");
console.log("Top 10 Longest Running Test Suites:");
console.log("------------------------------------");

suites.slice(0, 10).forEach((suite, index) => {
  const seconds = (suite.duration / 1000).toFixed(3);
  console.log(`${index + 1}. ${suite.name}`);
  console.log(
    `   Duration: ${seconds}s | Tests: ${suite.numTests} | Status: ${suite.status}`,
  );
});

// Now extract all individual tests with their timings
const allTests: Array<{
  suite: string;
  title: string;
  fullName: string;
  duration: number;
  status: string;
}> = [];

testResults.testResults.forEach((suite) => {
  const suiteName = suite.name.replace("/workspace/", "");

  if (suite.assertionResults) {
    suite.assertionResults.forEach((test) => {
      if (test.duration !== undefined) {
        allTests.push({
          suite: suiteName,
          title: test.title,
          fullName: test.fullName,
          duration: test.duration,
          status: test.status,
        });
      }
    });
  }
});

// Sort individual tests by duration
allTests.sort((a, b) => b.duration - a.duration);

console.log("\n=== INDIVIDUAL TEST TIMINGS (longest first) ===\n");
console.log("Top 20 Longest Running Individual Tests:");
console.log("-----------------------------------------");

allTests.slice(0, 20).forEach((test, index) => {
  const ms = test.duration;
  const seconds = (ms / 1000).toFixed(3);
  console.log(`${index + 1}. ${test.title}`);
  console.log(`   Suite: ${test.suite}`);
  console.log(`   Duration: ${ms}ms (${seconds}s) | Status: ${test.status}`);
});

// Summary statistics
const totalDuration = testResults.testResults.reduce(
  (sum, suite) => sum + (suite.endTime - suite.startTime),
  0,
);
const totalTests = testResults.numTotalTests;
const passedTests = testResults.numPassedTests;
const failedTests = testResults.numFailedTests;

console.log("\n=== SUMMARY STATISTICS ===\n");
console.log(`Total Test Suites: ${testResults.numTotalTestSuites}`);
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
console.log(
  `Average Test Duration: ${(totalDuration / totalTests).toFixed(0)}ms`,
);

// Find suites that took more than 5 seconds
const slowSuites = suites.filter((s) => s.duration > 5000);
console.log(`\nSuites taking > 5 seconds: ${slowSuites.length}`);
slowSuites.forEach((suite) => {
  console.log(`  - ${suite.name}: ${(suite.duration / 1000).toFixed(2)}s`);
});

// Find tests taking more than 3 seconds
const verySlowTests = allTests.filter((t) => t.duration > 3000);
if (verySlowTests.length > 0) {
  console.log(`\nTests taking > 3 seconds: ${verySlowTests.length}`);
  console.log(
    "Consider mocking network calls or reducing test scope for these tests.",
  );
}
