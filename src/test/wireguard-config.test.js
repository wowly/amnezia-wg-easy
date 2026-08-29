'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const QRCode = require('qrcode');

const testDirectory = path.join(
  os.tmpdir(),
  `amnezia-wg-easy-${process.pid}-${Date.now()}`,
);
const testDirectoryReady = fs.mkdir(testDirectory, { recursive: true });

process.env.WG_HOST = 'vpn.example.com';
process.env.WG_PATH = testDirectory;
for (const key of ['S3', 'S4', 'I1', 'I2', 'I3', 'I4', 'I5']) {
  delete process.env[key];
}

const Util = require('../lib/Util');

const originalExec = Util.exec;
const originalQRCodeToString = QRCode.toString;

Util.exec = async (command) => (command.includes('pubkey')
  ? 'server-public-key'
  : 'server-private-key');

const WireGuard = require('../lib/WireGuard');

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
