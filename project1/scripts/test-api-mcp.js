const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

async function testMCPServer(name, command, args, env, toolName, toolArgs) {
  console.log(`\n🧪 Testing ${name}...`);
  console.log(`Command: ${command} ${args.join(' ')}`);
  console.log(`Tool: ${toolName}`, toolArgs);
  
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      env: { ...process.env, ...env }
    });

    let stdout = '';
    let stderr = '';

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs
      }
    };

    console.log('📤 Request:', JSON.stringify(request));

    proc.stdin.write(JSON.stringify(request) + '\n');
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      console.log(`Exit code: ${code}`);
      
      if (stderr) {
        console.log('⚠️  STDERR:', stderr);
      }
      
      if (stdout) {
        console.log('📥 STDOUT:', stdout);
        try {
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          console.log('✅ Parsed response:', JSON.stringify(response, null, 2));
        } catch (err) {
          console.log('❌ Failed to parse JSON');
        }
      }
      
      resolve();
    });

    setTimeout(() => {
      proc.kill();
      console.log('⏱️  Timeout');
      resolve();
    }, 10000);
  });
}

async function main() {
  await testMCPServer(
    'AU Weather',
    'python3',
    [path.join(PROJECT_ROOT, 'mcp-servers/au-weather-mcp/server.py')],
    {},
    'get_weather',
    { location: 'Sydney' }
  );

  await testMCPServer(
    'Postcodes',
    '/Library/Frameworks/Python.framework/Versions/3.10/bin/fastmcp',
    ['run', path.join(PROJECT_ROOT, 'mcp-servers/australian-postcodes-mcp/src/server.py')],
    {},
    'search_postcodes',
    { query: 'Sydney' }
  );
}

main().catch(console.error);
