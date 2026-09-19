# AmnewziaWG Easy

You have found the easiest way to install & manage WireGuard on any Linux host!

<p align="center">
  <img src="./assets/screenshot.png" width="802" alt="screenshot"/>
</p>

## Features

* All-in-one: AmneziaWG 2.0 + Web UI.
* Easy installation, simple to use.
* List, create, edit, delete, enable & disable clients.
* Show a client's QR code.
* Download a client's configuration file.
* Statistics for which clients are connected.
* Tx/Rx charts for each connected client.
* Gravatar support or random avatars.
* Automatic Light / Dark Mode
* Multilanguage Support
* Traffic Stats (default off)
* One Time Links (default off)
* Client Expiry (default off)
* Prometheus metrics support

### Features added in this fork

* Support latest version of amneziawg by building from source
* Removed iptables-legacy
* Added firewall rules to prevent access to LAN (feel free to remove them with WG_POST_UP)
* Updated node version
* Latest golang version
* Fully transparent docker image build in ghcr.io

## Requirements

* A host with Docker installed.

## Installation

### 1. Install Docker

If you haven't installed Docker yet, install it by running:

```bash
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $(whoami)
exit
```

And log in again.

### 2. Run AmneziaWG Easy

To automatically install & run wg-easy, simply run:

```bash
  docker run -d \
  --name=amnezia-wg-easy \
  -e LANG=en \
  -e WG_HOST=<🚨YOUR_SERVER_IP> \
  -e PASSWORD_HASH=<🚨YOUR_ADMIN_PASSWORD_HASH> \
  -e PORT=51821 \
  -e WG_PORT=51820 \
  -v ~/.amnezia-wg-easy:/etc/amnezia/amneziawg/ \
  -p 51820:51820/udp \
  -p 51821:51821/tcp \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  --sysctl="net.ipv4.conf.all.src_valid_mark=1" \
  --sysctl="net.ipv4.ip_forward=1" \
  --device=/dev/net/tun:/dev/net/tun \
  --restart unless-stopped \
  ghcr.io/wowly/amnezia-wg-easy
```

> 💡 Replace `YOUR_SERVER_IP` with your WAN IP, or a Dynamic DNS hostname.
>
> 💡 Replace `YOUR_ADMIN_PASSWORD_HASH` with a bcrypt password hash to log in on the Web UI.
> See [How_to_generate_an_bcrypt_hash.md](./How_to_generate_an_bcrypt_hash.md) for know how generate the hash.

The Web UI will now be available on `http://0.0.0.0:51821`.

The Prometheus metrics will now be available on `http://0.0.0.0:51821/metrics`. Grafana dashboard [21733](https://grafana.com/grafana/dashboards/21733-wireguard/)

> 💡 Your configuration files will be saved in `~/.amnezia-wg-easy`

## Options

These options can be configured by setting environment variables using `-e KEY="VALUE"` in the `docker run` command.

| Env                           | Default           | Example                        | Description                                                                                                                                                                                                              |
|-------------------------------|-------------------|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `AWG_PROTOCOL_VERSION`        | Saved version / `2` | `3`                          | Select `1`, `2`, or `3` (AmneziaWG 3.1). Explicitly setting it also migrates an existing installation; see below. |
| `PORT`                        | `51821`           | `6789`                         | TCP port for Web UI.                                                                                                                                                                                                     |
| `WEBUI_HOST`                  | `0.0.0.0`         | `localhost`                    | IP address web UI binds to.                                                                                                                                                                                              |
| `PASSWORD_HASH`               | -                 | `$2y$05$Ci...`                 | When set, requires a password when logging in to the Web UI. See [How to generate an bcrypt hash.md]("https://github.com/wg-easy/wg-easy/blob/master/How_to_generate_an_bcrypt_hash.md") for know how generate the hash. |
| `WG_HOST`                     | -                 | `vpn.myserver.com`             | The public hostname of your VPN server.                                                                                                                                                                                  |
| `WG_DEVICE`                   | `eth0`            | `ens6f0`                       | Ethernet device the wireguard traffic should be forwarded through.                                                                                                                                                       |
| `WG_PORT`                     | `51820`           | `12345`                        | The public UDP port of your VPN server. WireGuard will listen on that (othwise default) inside the Docker container.                                                                                                     |
| `WG_CONFIG_PORT`              | `51820`           | `12345`                        | The UDP port used on [Home Assistant Plugin](https://github.com/adriy-be/homeassistant-addons-jdeath/tree/main/wgeasy)                                                                                                   |
| `WG_MTU`                      | `null`            | `1420`                         | The MTU the clients will use. Server uses default WG MTU.                                                                                                                                                                |
| `WG_PERSISTENT_KEEPALIVE`     | `0`               | `25`                           | Value in seconds to keep the "connection" open. If this value is 0, then connections won't be kept alive.                                                                                                                |
| `WG_DEFAULT_ADDRESS`          | `10.8.0.x`        | `10.6.0.x`                     | Clients IP address range.                                                                                                                                                                                                |
| `WG_DEFAULT_DNS`              | `1.1.1.1`         | `8.8.8.8, 8.8.4.4`             | DNS server clients will use. If set to blank value, clients will not use any DNS.                                                                                                                                        |
| `WG_ALLOWED_IPS`              | `0.0.0.0/0, ::/0` | `192.168.15.0/24, 10.0.1.0/24` | Allowed IPs clients will use.                                                                                                                                                                                            |
| `WG_PRE_UP`                   | `...`             | -                              | See [config.js](https://github.com/wg-easy/wg-easy/blob/master/src/config.js#L19) for the default value.                                                                                                                 |
| `WG_POST_UP`                  | `...`             | `iptables ...`                 | See [config.js](https://github.com/wg-easy/wg-easy/blob/master/src/config.js#L20) for the default value.                                                                                                                 |
| `WG_PRE_DOWN`                 | `...`             | -                              | See [config.js](https://github.com/wg-easy/wg-easy/blob/master/src/config.js#L27) for the default value.                                                                                                                 |
| `WG_POST_DOWN`                | `...`             | `iptables ...`                 | See [config.js](https://github.com/wg-easy/wg-easy/blob/master/src/config.js#L28) for the default value.                                                                                                                 |
| `WG_ENABLE_EXPIRES_TIME`      | `false`           | `true`                         | Enable expire time for clients                                                                                                                                                                                           |
| `LANG`                        | `en`              | `de`                           | Web UI language (Supports: en, ua, ru, tr, no, pl, fr, de, ca, es, ko, vi, nl, is, pt, chs, cht, it, th, hi).                                                                                                            |
| `UI_TRAFFIC_STATS`            | `false`           | `true`                         | Enable detailed RX / TX client stats in Web UI                                                                                                                                                                           |
| `UI_CHART_TYPE`               | `0`               | `1`                            | UI_CHART_TYPE=0 # Charts disabled, UI_CHART_TYPE=1 # Line chart, UI_CHART_TYPE=2 # Area chart, UI_CHART_TYPE=3 # Bar chart                                                                                               |
| `DICEBEAR_TYPE`               | `false`           | `bottts`                       | see [dicebear types](https://www.dicebear.com/styles/)                                                                                                                                                                   |
| `USE_GRAVATAR`                | `false`           | `true`                         | Use or not GRAVATAR service                                                                                                                                                                                              |
| `WG_ENABLE_ONE_TIME_LINKS`    | `false`           | `true`                         | Enable display and generation of short one time download links (expire after 5 minutes)                                                                                                                                  |
| `MAX_AGE`                     | `0`               | `1440`                         | The maximum age of Web UI sessions in minutes. `0` means that the session will exist until the browser is closed.                                                                                                        |
| `UI_ENABLE_SORT_CLIENTS`      | `false`           | `true`                         | Enable UI sort clients by name                                                                                                                                                                                           |
| `ENABLE_PROMETHEUS_METRICS`   | `false`           | `true`                         | Enable Prometheus metrics `http://0.0.0.0:51821/metrics` and `http://0.0.0.0:51821/metrics/json`                                                                                                                         |
| `PROMETHEUS_METRICS_PASSWORD` | -                 | `$2y$05$Ci...`                 | If set, Basic Auth is required when requesting metrics. See [How to generate an bcrypt hash.md]("https://github.com/wg-easy/wg-easy/blob/master/How_to_generate_an_bcrypt_hash.md") for know how generate the hash.      |
| `JC`                          | `random`          | `5`                            | Junk packet count — number of packets with random data that are sent before the start of the session.                                                                                                                    |
| `JMIN`                        | `50`              | `25`                           | Junk packet minimum size — minimum packet size for Junk packet. That is, all randomly generated packets will have a size no smaller than Jmin.                                                                           |
| `JMAX`                        | `1000`            | `250`                          | Junk packet maximum size — maximum size for Junk packets.                                                                                                                                                                |
| `S1`                          | `random`          | `75`                           | Init packet junk size — the size of random data that will be added to the init packet, the size of which is initially fixed.                                                                                             |
| `S2`                          | `random`          | `75`                           | Response packet junk size — the size of random data that will be added to the response packet, the size of which is initially fixed.                                                                                     |
| `S3`                          | `random`          | `32`                           | Cookie reply packet padding used by AmneziaWG 2.0.                                                                                                                                                                       |
| `S4`                          | `random`          | `32`                           | Transport packet padding used by AmneziaWG 2.0.                                                                                                                                                                          |
| `H1`                          | `random`          | `1234567891`                   | Init packet magic header — the header of the first byte of the handshake. Must be < uint_max.                                                                                                                            |
| `H2`                          | `random`          | `1234567892`                   | Response packet magic header — header of the first byte of the handshake response. Must be < uint_max.                                                                                                                   |
| `H3`                          | `random`          | `1234567893`                   | Underload packet magic header — UnderLoad packet header. Must be < uint_max.                                                                                                                                             |
| `H4`                          | `random`          | `1234567894`                   | Transport packet magic header — header of the packet of the data packet. Must be < uint_max.                                                                                                                             |
| `I1` ... `I5`                | `<r random>`      | `<b 0x0102><r 16>`             | AmneziaWG 2.0 custom signature packet templates. Supported tags are `<b 0x...>`, `<r N>`, `<rd N>`, `<rc N>`, and `<t>`.                                                                                                  |

> If you change `WG_PORT`, make sure to also change the exposed port.

### AmneziaWG protocol version

Set `AWG_PROTOCOL_VERSION` in `.env` (loaded by Docker Compose) or pass it with
`docker run -e AWG_PROTOCOL_VERSION=3`:

| Value | Protocol |
| --- | --- |
| `1` | AmneziaWG 1.x: `Jc`, `Jmin`, `Jmax`, `S1`, `S2`, `H1`–`H4` |
| `2` | AmneziaWG 2.0: additionally `S3`, `S4`, `I1`–`I5` |
| `3` | AmneziaWG 3.1: additionally header protection, content padding, and optional timing settings |

Use `3`, not `3.1`. Other values, including an empty value, cause a startup error.
When omitted, new installations use version `2` and existing installations keep
their saved version, including legacy `wg0.json` files without `protocolVersion`.

To switch an existing installation to 3.1, add this line to `.env` and recreate
the container with `docker compose up -d --force-recreate`:

```dotenv
AWG_PROTOCOL_VERSION=3
```

An explicit version applies to existing configurations too. Client records,
addresses, and WireGuard keys are preserved. Parameters specific to newer
versions are removed when downgrading. **After changing versions, download and
import updated configurations (or scan new QR codes) on all clients.** Version
3 requires clients supporting AmneziaWG 3.1. Back up `wg0.json` before migrating.
Downgrading to version 1 requires single integers in `H1`–`H4`, not ranges.

For version 3, a random 32-byte `HeaderProtectionKey` is generated once and saved
in `wg0.json`. The same key is included in server, download, and QR configurations
and survives container restarts. Existing `S1`–`S4` values below 12 are raised to
12 during migration; explicitly supplied ENV values below 12 are rejected.

The following optional ENV variables apply only to version 3. Explicit values
override saved values on startup; otherwise saved values are retained.

| Variable | Default for a new 3.1 configuration | Format |
| --- | --- | --- |
| `HEADER_PROTECTION_KEY` | Generated and persisted | Nonzero 32-byte base64 key |
| `CONTENT_PADDING_ADDITION` | `0-64` | Integer or inclusive range, e.g. `16-128` |
| `REKEY_AFTER_TIME` | Protocol default | Seconds, integer or range |
| `REKEY_TIMEOUT` | Protocol default | Seconds, integer or range |
| `REJECT_AFTER_TIME` | Protocol default | Seconds, integer or range |
| `KEEPALIVE_TIMEOUT` | Protocol default | Seconds, integer or range |
| `MAX_HANDSHAKE_ATTEMPTS` | Protocol default | Count, integer or range |
| `RANDOM_TRAILERS` | Protocol default | `0`, `1`, `off`, or `on` |
| `DISABLE_COOKIES` | Protocol default | `0`, `1`, `off`, or `on` |

Numeric values and range endpoints above are limited to `0`–`65535` by the
bundled `amneziawg-tools`. `WG_PERSISTENT_KEEPALIVE` also accepts a range with
version 3. The Dockerfile already pins 3.1-compatible tools and userspace engine.
See the [upstream protocol documentation](https://github.com/amnezia-vpn/amneziawg-go/tree/v3.1.20260828#configuration)
for parameter semantics.

## Updating

To update to the latest version, simply run:

```bash
docker stop amnezia-wg-easy
docker rm amnezia-wg-easy
docker pull ghcr.io/wowly/amnezia-wg-easy
```

And then run the `docker run -d \ ...` command above again.

## Thanks

Based on [wg-easy](https://github.com/wg-easy/wg-easy) by Emile Nijssen.  
Use integrations with AmneziaWg from [amnezia-wg-easy](https://github.com/spcfox/amnezia-wg-easy) by Viktor Yudov.
