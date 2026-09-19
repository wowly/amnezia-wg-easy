'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const QRCode = require('qrcode');

const testDirectory = path.join(
  os.tmpdir(),
  `amnezia-wg-easy-${process.pid}-${Date.now()}`,
);
const testDirectoryReady = fs.mkdir(testDirectory, { recursive: true });

process.env.WG_HOST = 'vpn.example.com';
process.env.WG_PATH = testDirectory;
const protocolEnv = [
  'AWG_PROTOCOL_VERSION', 'S1', 'S2', 'S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5',
  'HEADER_PROTECTION_KEY', 'CONTENT_PADDING_ADDITION', 'REKEY_AFTER_TIME',
  'REKEY_TIMEOUT', 'REJECT_AFTER_TIME', 'KEEPALIVE_TIMEOUT', 'MAX_HANDSHAKE_ATTEMPTS',
  'RANDOM_TRAILERS', 'DISABLE_COOKIES',
];
for (const key of protocolEnv) {
  delete process.env[key];
}

const Util = require('../lib/Util');

const originalExec = Util.exec;
const originalQRCodeToString = QRCode.toString;

Util.exec = async (command) => (command.includes('pubkey')
  ? 'server-public-key'
  : 'server-private-key');

const WireGuard = require('../lib/WireGuard');
const settings = require('../config');
const { applyProtocolVersion } = require('../lib/AmneziaConfig');

test.afterEach(() => {
  settings.AWG_PROTOCOL_VERSION = null;
  for (const key of protocolEnv) delete process.env[key];
});

const legacyServer = {
  privateKey: 'legacy-server-private-key',
  publicKey: 'legacy-server-public-key',
  address: '10.8.0.1',
  jc: 5,
  jmin: 50,
  jmax: 1000,
  s1: 71,
  s2: 83,
  h1: 1001,
  h2: 1002,
  h3: 1003,
  h4: 1004,
};

const v2Server = {
  ...legacyServer,
  protocolVersion: 2,
  s3: 33,
  s4: 44,
  i1: '<r 101>',
  i2: '<rd 12>',
  i3: '<rc 15>',
  i4: '<b 0x0102>',
  i5: '<t>',
};

const client = {
  name: 'Test client',
  address: '10.8.0.2',
  privateKey: 'client-private-key',
  publicKey: 'client-public-key',
  preSharedKey: 'client-preshared-key',
  enabled: true,
};

test.after(async () => {
  Util.exec = originalExec;
  QRCode.toString = originalQRCodeToString;
  await fs.rm(testDirectory, { recursive: true });
});

test('a fresh installation creates an AWG 2.0 server configuration', async () => {
  await testDirectoryReady;

  const wireGuard = new WireGuard();
  const config = await wireGuard.__buildConfig();

  assert.equal(config.server.protocolVersion, 2);
  assert.ok(config.server.s3 >= 15 && config.server.s3 < 150);
  assert.ok(config.server.s4 >= 15 && config.server.s4 < 150);

  for (const key of ['i1', 'i2', 'i3', 'i4', 'i5']) {
    const match = /^<r (\d+)>$/.exec(config.server[key]);
    assert.ok(match);
    assert.ok(Number(match[1]) >= 32 && Number(match[1]) < 1000);
  }
});

test('saving a legacy configuration does not silently upgrade it', async () => {
  await testDirectoryReady;
  const config = {
    server: legacyServer,
    clients: {},
  };
  const wireGuard = new WireGuard();

  await wireGuard.__saveConfig(config);
  wireGuard.getConfig = async () => config;
  wireGuard.getClient = async () => client;

  const json = JSON.parse(await fs.readFile(path.join(testDirectory, 'wg0.json')));
  const generated = await fs.readFile(path.join(testDirectory, 'wg0.conf'), 'utf8');
  const clientConfig = await wireGuard.getClientConfiguration({ clientId: 'test' });

  assert.deepEqual(json, config);
  assert.doesNotMatch(generated, /^(S3|S4|I[1-5]) =/m);
  assert.doesNotMatch(clientConfig, /^(S3|S4|I[1-5]) =/m);
  assert.match(generated, /^S2 = 83$/m);
  assert.match(generated, /^H4 = 1004$/m);
});

test('server, downloaded, and QR source configs contain AWG 2.0 fields', async () => {
  await testDirectoryReady;
  const config = {
    server: v2Server,
    clients: { test: client },
  };
  const wireGuard = new WireGuard();

  await wireGuard.__saveConfig(config);
  wireGuard.getConfig = async () => config;
  wireGuard.getClient = async () => client;
  let qrSourceConfig;
  QRCode.toString = async (sourceConfig) => {
    qrSourceConfig = sourceConfig;
    return '<svg />';
  };

  const serverConfig = await fs.readFile(path.join(testDirectory, 'wg0.conf'), 'utf8');
  const clientConfig = await wireGuard.getClientConfiguration({ clientId: 'test' });
  await wireGuard.getClientQRCodeSVG({ clientId: 'test' });

  for (const generated of [serverConfig, clientConfig, qrSourceConfig]) {
    assert.match(generated, /^S3 = 33$/m);
    assert.match(generated, /^S4 = 44$/m);
    assert.match(generated, /^I1 = <r 101>$/m);
    assert.match(generated, /^I2 = <rd 12>$/m);
    assert.match(generated, /^I3 = <rc 15>$/m);
    assert.match(generated, /^I4 = <b 0x0102>$/m);
    assert.match(generated, /^I5 = <t>$/m);
    assert.doesNotMatch(generated, /undefined/);
  }
});

test('ENV accepts exactly 1, 2, and 3', () => {
  for (const value of ['1', '2', '3', '3.1', '0', '4', '', '2foo']) {
    const result = spawnSync(process.execPath, ['-e', 'require("./config")'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, AWG_PROTOCOL_VERSION: value },
      encoding: 'utf8',
    });
    if (['1', '2', '3'].includes(value)) assert.equal(result.status, 0, result.stderr);
    else assert.match(result.stderr, /AWG_PROTOCOL_VERSION must be/);
  }
});

for (const version of [1, 2, 3]) {
  test(`fresh installation supports explicit protocol ${version}`, async () => {
    await testDirectoryReady;
    await fs.rm(path.join(testDirectory, 'wg0.json'), { force: true });
    settings.AWG_PROTOCOL_VERSION = version;
    const config = await new WireGuard().__buildConfig();
    assert.equal(config.server.protocolVersion, version);
    assert.equal('s3' in config.server, version >= 2);
    assert.equal('i1' in config.server, version >= 2);
    assert.equal('headerProtectionKey' in config.server, version === 3);
  });
}

test('AWG 3.1 migration preserves clients and keys and exports matching server, download and QR fields', async () => {
  const original = { server: { ...legacyServer, s1: 0 }, clients: { test: client } };
  await fs.writeFile(path.join(testDirectory, 'wg0.json'), JSON.stringify(original));
  settings.AWG_PROTOCOL_VERSION = 3;
  Object.assign(process.env, {
    CONTENT_PADDING_ADDITION: '16-128',
    REKEY_AFTER_TIME: '100-120',
    REKEY_TIMEOUT: '4-6',
    REJECT_AFTER_TIME: '160-180',
    KEEPALIVE_TIMEOUT: '10-15',
    MAX_HANDSHAKE_ATTEMPTS: '15-20',
    RANDOM_TRAILERS: '1',
    DISABLE_COOKIES: '0',
  });
  const wireGuard = new WireGuard();
  const config = await wireGuard.__buildConfig();
  assert.deepEqual(config.clients, original.clients);
  assert.equal(config.server.privateKey, legacyServer.privateKey);
  assert.equal(config.server.publicKey, legacyServer.publicKey);
  assert.equal(config.server.s1, 12);
  assert.equal(config.server.s2, legacyServer.s2);
  assert.equal(Buffer.from(config.server.headerProtectionKey, 'base64').length, 32);
  await wireGuard.__saveConfig(config);

  let qrSource;
  QRCode.toString = async (source) => {
    qrSource = source;
    return '<svg />';
  };
  const downloaded = await wireGuard.getClientConfiguration({ clientId: 'test' });
  await wireGuard.getClientQRCodeSVG({ clientId: 'test' });
  const server = await fs.readFile(path.join(testDirectory, 'wg0.conf'), 'utf8');
  for (const generated of [server, downloaded, qrSource]) {
    assert.ok(generated.includes(`HeaderProtectionKey = ${config.server.headerProtectionKey}\n`));
    assert.match(generated, /^ContentPaddingAddition = 16-128$/m);
    assert.match(generated, /^RekeyAfterTime = 100-120$/m);
    assert.match(generated, /^RekeyTimeout = 4-6$/m);
    assert.match(generated, /^RejectAfterTime = 160-180$/m);
    assert.match(generated, /^KeepaliveTimeout = 10-15$/m);
    assert.match(generated, /^MaxHandshakeAttempts = 15-20$/m);
    assert.match(generated, /^RandomTrailers = 1$/m);
    assert.match(generated, /^DisableCookies = 0$/m);
    assert.doesNotMatch(generated, /undefined/);
  }
  settings.AWG_PROTOCOL_VERSION = null;
  for (const key of protocolEnv) delete process.env[key];
  const reloaded = await new WireGuard().__buildConfig();
  assert.deepEqual(reloaded, config);

  for (const version of [2, 1]) {
    settings.AWG_PROTOCOL_VERSION = version;
    const downgraded = await new WireGuard().__buildConfig();
    assert.equal(downgraded.server.protocolVersion, version);
    assert.deepEqual(downgraded.clients, original.clients);
    await wireGuard.__saveConfig(downgraded);
    const generated = await fs.readFile(path.join(testDirectory, 'wg0.conf'), 'utf8');
    assert.doesNotMatch(generated, /^(HeaderProtectionKey|ContentPaddingAddition|RandomTrailers|DisableCookies|RekeyAfterTime) =/m);
    if (version === 1) assert.doesNotMatch(generated, /^(S3|S4|I[1-5]) =/m);
  }
});

test('legacy and v2 files are preserved when the protocol ENV is absent', async () => {
  for (const server of [legacyServer, v2Server]) {
    const original = { server, clients: { test: client } };
    await fs.writeFile(path.join(testDirectory, 'wg0.json'), JSON.stringify(original));
    assert.deepEqual(await new WireGuard().__buildConfig(), original);
  }
});

test('invalid AWG 3.1 values fail before overwriting a saved configuration', async () => {
  settings.AWG_PROTOCOL_VERSION = 3;
  const original = JSON.stringify({ server: v2Server, clients: { test: client } });
  await fs.writeFile(path.join(testDirectory, 'wg0.json'), original);
  for (const [env, value, message] of [
    ['S1', '11', /S1 must be/],
    ['S4', '65536', /S4 must be/],
    ['HEADER_PROTECTION_KEY', 'invalid', /HEADER_PROTECTION_KEY/],
    ['HEADER_PROTECTION_KEY', Buffer.alloc(32).toString('base64'), /HEADER_PROTECTION_KEY/],
    ['CONTENT_PADDING_ADDITION', '100-10', /ContentPaddingAddition/],
    ['REKEY_TIMEOUT', '1\nPostUp=bad', /RekeyTimeout/],
    ['RANDOM_TRAILERS', 'true', /RandomTrailers/],
  ]) {
    process.env[env] = value;
    await assert.rejects(new WireGuard().getConfig(), message);
    assert.equal(await fs.readFile(path.join(testDirectory, 'wg0.json'), 'utf8'), original);
    delete process.env[env];
  }
});

test('a custom header key and zero padding addition are preserved', () => {
  settings.AWG_PROTOCOL_VERSION = 3;
  process.env.HEADER_PROTECTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.CONTENT_PADDING_ADDITION = '0';
  const server = { ...v2Server };
  applyProtocolVersion(server);
  assert.equal(server.headerProtectionKey, process.env.HEADER_PROTECTION_KEY);
  assert.equal(server.contentPaddingAddition, '0');
});

test('corrupt saved JSON is not replaced with new keys', async () => {
  await fs.writeFile(path.join(testDirectory, 'wg0.json'), '{broken');
  await assert.rejects(new WireGuard().getConfig(), SyntaxError);
  assert.equal(await fs.readFile(path.join(testDirectory, 'wg0.json'), 'utf8'), '{broken');
});
