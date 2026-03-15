const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MCP_SERVERS_DIR = path.join(PROJECT_ROOT, 'mcp-servers');

const servers = [
  {
    name: 'AU Weather MCP',
    command: 'python3',
    args: [path.join(MCP_SERVERS_DIR, 'au-weather-mcp/server.py')],
    env: {},
    testInput: '{"jsonrpc":"2.0","method":"tools/list","id":1}\n'
  },
  {
    name: 'ABS Statistics (TypeScript)',
    command: 'node',
    args: [path.join(MCP_SERVERS_DIR, 'mcp-server-abs/build/index.js')],
    env: {},
    testInput: '{"jsonrpc":"2.0","method":"tools/list","id":1}\n'
  },
  {
    name: 'Australian Postcodes',
    command: '/Library/Frameworks/Python.framework/Versions/3.10/bin/fastmcp',
    args: ['run', path.join(MCP_SERVERS_DIR, 'australian-postcodes-mcp/src/server.py')],
    env: {},
    testInput: '{"jsonrpc":"2.0","method":"tools/list","id":1}\n'
  },
  {
    name: 'Transport NSW',
    command: '/Library/Frameworks/Python.framework/Versions/3.10/bin/fastmcp',
    args: ['run', path.join(MCP_SERVERS_DIR, 'transportnsw-mcp/api.py')],
    env: { OPEN_TRANSPORT_API_KEY: 'Paris404' },
    testInput: '{"jsonrpc":"2.0","method":"tools/list","id":1}\n'
  }
];

console.log('🧪 Testing MCP Servers...\n');
console.log('=' .repeat(60));

let successCount = 0;
let failCount = 0;

async function testServer(server) {
  return new Promise((resolve) => {
    console.log(`\n📦 Testing: ${server.name}`);
    console.log(`   Command: ${server.command} ${server.args.join(' ')}`);
    
    const proc = spawn(server.command, server.args, {
      env: { ...process.env, ...server.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let responded = false;

    const timeout = setTimeout(() => {
      if (!responded) {
        proc.kill();
        console.log('   ❌ TIMEOUT - Server did not respond within 5 seconds');
        failCount++;
        resolve();
      }
    }, 5000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.includes('"jsonrpc":"2.0"') && !responded) {
        responded = true;
        clearTimeout(timeout);
        proc.kill();
        console.log('   ✅ PASS - Server responded correctly');
        successCount++;
        resolve();
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        console.log(`   ❌ FAIL - Error: ${error.message}`);
        failCount++;
        resolve();
      }
    });

    proc.on('close', (code) => {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        if (code === 0) {
          console.log('   ⚠️  WARNING - Server exited without responding');
        } else {
          console.log(`   ❌ FAIL - Exit code ${code}`);
          if (stderr) {
            console.log(`   Error: ${stderr.substring(0, 200)}`);
          }
        }
        failCount++;
        resolve();
      }
    });

    setTimeout(() => {
      if (proc.stdin.writable) {
        proc.stdin.write(server.testInput);
        proc.stdin.end();
      }
    }, 1000);
  });
}

async function runTests() {
  for (const server of servers) {
    await testServer(server);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Total: ${successCount + failCount}\n`);

  if (failCount === 0) {
    console.log('🎉 All MCP servers are working correctly!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some MCP servers failed. Check configuration and dependencies.\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
