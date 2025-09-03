# Build the control panel server
FROM docker.io/library/node:lts-alpine AS build_node

# Update npm to latest
RUN npm install -g npm@latest

# Copy Web UI
COPY src /app
WORKDIR /app
RUN npm ci --omit=dev && \
    mv node_modules /node_modules

# Build amneziawg itself
FROM golang:1.24-alpine AS build_awg
RUN apk add --no-cache git make gcc musl-dev linux-headers

WORKDIR /tools
# Build tools (awg and awg-quick)
RUN git clone --branch v1.0.20250901 --single-branch https://github.com/amnezia-vpn/amneziawg-tools.git
RUN cd amneziawg-tools/src && make

# Build amneziawg-go
RUN git clone --branch v0.2.15 --single-branch https://github.com/amnezia-vpn/amneziawg-go.git
RUN cd amneziawg-go && make

# Copy build result to a new image.
# This saves a lot of disk space.
FROM alpine:3.22 AS runtime

COPY --from=build_awg /tools/amneziawg-go/amneziawg-go /usr/bin/amneziawg-go
COPY --from=build_awg /tools/amneziawg-tools/src/wg /usr/bin/wg
COPY --from=build_awg /tools/amneziawg-tools/src/wg-quick/linux.bash /usr/bin/wg-quick

# Link it to its other name (optional)
RUN ln -s /usr/bin/wg /usr/bin/awg && ln -s /usr/bin/wg-quick /usr/bin/awg-quick

HEALTHCHECK CMD /usr/bin/timeout 5s /bin/sh -c "/usr/bin/wg show | /bin/grep -q interface || exit 1" --interval=1m --timeout=5s --retries=3
COPY --from=build_node /app /app

# Move node_modules one directory up, so during development
# we don't have to mount it in a volume.
# This results in much faster reloading!
#
# Also, some node_modules might be native, and
# the architecture & OS of your development machine might differ
# than what runs inside of docker.
COPY --from=build_node /node_modules /node_modules

# Copy the needed wg-password scripts
COPY --from=build_node /app/wgpw.sh /bin/wgpw
RUN chmod +x /bin/wgpw

# Install Linux packages
RUN apk add --no-cache \
    iproute2 \
    iptables \
    bash \
    dpkg \
    dumb-init \
    # iptables-legacy \
    nodejs \
    npm

# Use iptables-legacy (I don't think we need this anymore)
# RUN update-alternatives --install /sbin/iptables iptables /usr/sbin/iptables-legacy 10 --slave /sbin/iptables-restore iptables-restore /usr/sbin/iptables-legacy-restore --slave /sbin/iptables-save iptables-save /usr/sbin/iptables-legacy-save

# Set Environment
ENV DEBUG=Server,WireGuard

# Make the default dir for wg0.conf
# RUN mkdir -p /etc/amnezia/amneziawg/

WORKDIR /app

# Run Web UI
CMD ["/usr/bin/dumb-init", "node", "server.js"]
