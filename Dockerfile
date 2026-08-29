# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24-alpine
ARG GO_IMAGE=golang:1.27-alpine
ARG RUNTIME_IMAGE=alpine:3.24
ARG AWG_TOOLS_VERSION=v1.0.20260618-2
ARG AWG_GO_VERSION=v0.2.19

FROM ${NODE_IMAGE} AS node_deps
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

FROM node_deps AS app
COPY src/ ./
RUN mv node_modules /node_modules

FROM ${GO_IMAGE} AS awg_builder
ARG AWG_TOOLS_VERSION
ARG AWG_GO_VERSION

WORKDIR /tools
RUN apk add --no-cache \
    gcc \
    git \
    linux-headers \
    make \
    musl-dev

RUN git clone --depth 1 --branch "${AWG_TOOLS_VERSION}" --single-branch https://github.com/amnezia-vpn/amneziawg-tools.git \
    && make -C amneziawg-tools/src \
    && git clone --depth 1 --branch "${AWG_GO_VERSION}" --single-branch https://github.com/amnezia-vpn/amneziawg-go.git \
    && make -C amneziawg-go

FROM ${RUNTIME_IMAGE} AS runtime

RUN apk add --no-cache \
    bash \
    dpkg \
    dumb-init \
    iproute2 \
    iptables \
    nodejs \
    npm

COPY --from=awg_builder /tools/amneziawg-go/amneziawg-go /usr/bin/amneziawg-go
COPY --from=awg_builder /tools/amneziawg-tools/src/wg /usr/bin/wg
COPY --from=awg_builder /tools/amneziawg-tools/src/wg-quick/linux.bash /usr/bin/wg-quick
COPY --from=app /app /app
COPY --from=app /node_modules /node_modules
COPY --from=app --chmod=755 /app/wgpw.sh /bin/wgpw

RUN ln -s /usr/bin/wg /usr/bin/awg \
    && ln -s /usr/bin/wg-quick /usr/bin/awg-quick

ENV DEBUG=Server,WireGuard

WORKDIR /app

HEALTHCHECK --interval=1m --timeout=5s --retries=3 \
    CMD ["/usr/bin/timeout", "5s", "/bin/sh", "-c", "/usr/bin/wg show | /bin/grep -q interface"]

CMD ["/usr/bin/dumb-init", "--", "node", "server.js"]
