import { runCompleteElectionTestSuite } from '../src/server/tests.js';

async function main() {
  console.log('Starting IZI 2027-2028 MAKAI DING KI TEL NA Comprehensive Lifecycle, Round 3 & Security Test Suite...\n');
  const report = await runCompleteElectionTestSuite();

  console.log('----------------------------------------------------');
  console.log(`Test Execution Finished in ${report.totalDurationMs} ms`);
  console.log(`Total Scenarios: ${report.totalTests}`);
  console.log(`Passed: ${report.passedCount} | Failed: ${report.failedCount}`);
  console.log('----------------------------------------------------\n');

  report.results.forEach((test) => {
    const symbol = test.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${symbol}] Test ${test.id}: ${test.name} (${test.durationMs}ms)`);
    console.log(`       Message: ${test.message}`);
    if (test.details) {
      test.details.forEach((d) => console.log(`       > ${d}`));
    }
  });

  if (!report.allPassed) {
    console.error(`\nOne or more tests failed! (${report.failedCount} failures)`);
    process.exit(1);
  } else {
    console.log(`\nAll ${report.totalTests} lifecycle, Round 3, round reset, and security scenarios passed with 100% compliance!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
