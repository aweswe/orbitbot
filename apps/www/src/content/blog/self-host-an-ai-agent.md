---
title: "How to self-host Orbit Bot"
description: "Run Orbit Bot on a machine you control with the published Docker images, a source checkout, or the desktop app's local stack."
published: "2026-11-10"
updated: "2026-11-10"
author: "Orbit team"
category: "guides"
tldr: "Orbit Bot can run on infrastructure you control. The published-image installer is the shortest path; a source checkout is for development; the desktop app can start a local stack or connect to an existing server."
sources:
  - label: "Orbit Bot README"
    href: "https://github.com/forion-ai/orbit/blob/main/README.md"
  - label: "Self-hosting guide"
    href: "https://github.com/forion-ai/orbit/blob/main/docs/self-host.md"
  - label: "Production deployment"
    href: "https://github.com/forion-ai/orbit/blob/main/docs/self-host-production.md"
related:
  - href: "/download/"
    title: "Download Orbit"
    description: "Desktop, mobile, and web clients for the same workspace."
  - href: "/about/"
    title: "About Orbit Bot"
    description: "The Orbit and Forion product hierarchy and source attribution."
  - href: "/support/"
    title: "Support"
    description: "Where to ask for help and how to report a reproducible bug."
  - href: "/pricing/"
    title: "Pricing"
    description: "Plans and usage are managed in the Orbit app."
faq:
  - question: "Do I need a hosted Orbit account to self-host?"
    answer: "No. A self-hosted deployment runs the same Orbit Bot product on infrastructure you control. You create an account on that deployment and connect a model."
  - question: "Do I need Node.js for the published images?"
    answer: "No. The published-image path needs Docker Engine, the Compose plugin, curl, and OpenSSL. Node.js is for a source checkout."
  - question: "Where does my data live?"
    answer: "The database, bot files, browser profiles, and audit log stay on the deployment you run. Prompts you send to a model provider are processed by that provider under your agreement with it."
  - question: "Can the desktop app run Orbit locally?"
    answer: "Yes. The desktop app can start the published Compose stack under its data directory, or connect to a server that is already running."
comparison:
  caption: "Ways to run Orbit Bot"
  columns:
    - "Path"
    - "Published images"
    - "Source checkout"
    - "Desktop local stack"
  rows:
    - topic: "Best for"
      cells:
        - "A server or workstation you want to keep running"
        - "Development and unmerged changes"
        - "Trying Orbit on one computer"
    - topic: "Requires"
      cells:
        - "Docker Engine, Compose, curl, OpenSSL"
        - "Node.js, pnpm, Docker"
        - "Docker Desktop, OrbStack, or Docker Engine"
    - topic: "Updates"
      cells:
        - "Pull new image tags"
        - "Pull the repository and run the development workflow"
        - "The app manages the bundled stack"
---

Orbit Bot is an Orbit product powered by Forion. It runs as a web app, an Electron desktop app, and an Expo mobile app, all backed by the same API. You can use the hosted service or run the stack yourself.

## What you need

For the published images, you need Docker Engine, the Compose plugin, `curl`, and `OpenSSL`. No clone and no Node.js install are required. The installer downloads the Compose files, creates an `.env` with random secrets, and starts the stack. It preserves an existing `.env` when you rerun it.

The repository's [self-hosting guide](https://github.com/forion-ai/orbit/blob/main/docs/self-host.md) covers the installer, configuration, and the optional providers you can connect later.

## Published images

Download and run the installer from the repository:

```bash
mkdir -p orbit && cd orbit &&
curl -fsSLO https://raw.githubusercontent.com/forion-ai/orbit/main/infra/compose/install-images.sh &&
bash install-images.sh
```

When it finishes, open the local URL, create an account, and connect a model. Local Docker computers are on by default. Remote computer providers are optional and require their own credentials.

## Source checkout

Use a source checkout when you are changing Orbit Bot itself. The repository requires Node.js 22.22.2 or newer in the 22.x line, Node.js 24.x, or Node.js 26 or newer, plus pnpm and Docker. The development entry point applies migrations, generates the Prisma client, and starts the web app and API together:

```bash
pnpm install
pnpm sandbox:build
pnpm dev
```

The full setup, environment variables, and database details are in the [README](https://github.com/forion-ai/orbit/blob/main/README.md).

## Connect a client

The web app runs in a browser. The desktop app can connect to an existing instance or start a local stack. The mobile app connects to the same API. For a public server, put HTTPS in front of the web port; the [production deployment guide](https://github.com/forion-ai/orbit/blob/main/docs/self-host-production.md) covers the reverse proxy and host hardening.

## Where data lives

The deployment keeps its database, bot files, browser profiles, and audit log. Model prompts are sent to the provider you configure. Connector credentials are encrypted on the server and are not returned by the API.
