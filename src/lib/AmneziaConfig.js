'use strict';

const crypto = require('node:crypto');
const defaults = require('../config');

const v2Fields = ['s3', 's4', 'i1', 'i2', 'i3', 'i4', 'i5'];
const v3Fields = [
  ['HeaderProtectionKey', 'headerProtectionKey', 'HEADER_PROTECTION_KEY'],
  ['ContentPaddingAddition', 'contentPaddingAddition', 'CONTENT_PADDING_ADDITION'],
  ['RekeyAfterTime', 'rekeyAfterTime', 'REKEY_AFTER_TIME'],
  ['RekeyTimeout', 'rekeyTimeout', 'REKEY_TIMEOUT'],
  ['RejectAfterTime', 'rejectAfterTime', 'REJECT_AFTER_TIME'],
  ['KeepaliveTimeout', 'keepaliveTimeout', 'KEEPALIVE_TIMEOUT'],
  ['MaxHandshakeAttempts', 'maxHandshakeAttempts', 'MAX_HANDSHAKE_ATTEMPTS'],
  ['RandomTrailers', 'randomTrailers', 'RANDOM_TRAILERS'],
  ['DisableCookies', 'disableCookies', 'DISABLE_COOKIES'],
];

// Without an explicit selection, keep existing installations on their saved protocol.
const applyProtocolVersion = (server, fresh = false) => {
  const selected = defaults.AWG_PROTOCOL_VERSION;
  const version = selected ?? (fresh ? 2 : server.protocolVersion);
  if (version === undefined) return;
  if (![1, 2, 3].includes(version)) throw new Error('Unsupported saved AmneziaWG protocolVersion');

  server.protocolVersion = version;
  for (const key of v2Fields) {
    if (version >= 2) server[key] ??= defaults[key.toUpperCase()];
    else delete server[key];
  }
  if (version < 3) {
    for (const [, key] of v3Fields) delete server[key];
    // AWG 1 does not understand header ranges.
    if (selected === 1) {
      for (const key of ['h1', 'h2', 'h3', 'h4']) {
        if (!/^\d+$/.test(String(server[key]))) {
          throw new Error(`${key.toUpperCase()} must be a single integer for AWG_PROTOCOL_VERSION=1`);
        }
      }
    }
    return;
  }

  for (const key of ['s1', 's2', 's3', 's4']) {
    // A transition may need larger paddings; explicit ENV values take precedence.
    const value = process.env[key.toUpperCase()] ?? Math.max(12, Number(server[key]));
    if (!/^\d+$/.test(String(value)) || Number(value) < 12 || Number(value) > 65535) {
      throw new Error(`${key.toUpperCase()} must be an integer between 12 and 65535 for AmneziaWG 3.1`);
    }
    server[key] = Number(value);
  }

  for (const [, key, env] of v3Fields) {
    if (process.env[env] !== undefined) server[key] = process.env[env];
  }
  server.headerProtectionKey ??= crypto.randomBytes(32).toString('base64');
  const key = Buffer.from(server.headerProtectionKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== server.headerProtectionKey || key.every((byte) => byte === 0)) {
    throw new Error('HEADER_PROTECTION_KEY must be a nonzero 32-byte base64 key');
  }
  server.contentPaddingAddition ??= '0-64';

  for (const [name, field] of v3Fields.slice(1, 7)) {
    if (server[field] === undefined) continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(String(server[field]));
    if (!match || Number(match[1]) > Number(match[2] ?? match[1]) || Number(match[2] ?? match[1]) > 65535) {
      throw new Error(`${name} must be an integer or ascending range between 0 and 65535`);
    }
  }
  for (const [name, field] of v3Fields.slice(7)) {
    if (server[field] === undefined) continue;
    if (!['0', '1', 'on', 'off'].includes(String(server[field]))) {
      throw new Error(`${name} must be 0, 1, on, or off`);
    }
  }
};

const renderV3Fields = (server) => (server.protocolVersion === 3 ? v3Fields
  .filter(([, key]) => server[key] !== undefined)
  .map(([name, key]) => `${name} = ${server[key]}\n`).join('') : '');

module.exports = { applyProtocolVersion, renderV3Fields };
