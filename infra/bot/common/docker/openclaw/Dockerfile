FROM nikolaik/python-nodejs:latest
 
ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apt-get update && \
      DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $OPENCLAW_DOCKER_APT_PACKAGES && \
      apt-get clean && \
      rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*; \
    fi

RUN npm install --yes -g @openai/codex
RUN npm install --yes -g openclaw

# Writable directories for openclaw state and temp files
RUN mkdir -p /home/node/.openclaw /home/node/workspace /tmp \
    && chown pn:pn /home/node/.openclaw /home/node/workspace

# NODE_PATH lets Node resolve openclaw's bundled dependencies
#ENV NODE_PATH=/opt/openclaw/node_modules

# Put openclaw's dependency binaries on PATH
#ENV PATH="/opt/openclaw/node_modules/.bin:${PATH}"

# Symlink so `openclaw` is available as a command
#RUN ln -s /opt/openclaw/openclaw.mjs /usr/local/bin/openclaw

# Install yjs-plugin for openclaw channel integration
COPY yjs-plugin.js /opt/yjs-plugin/index.js

USER pn
WORKDIR /home/pn

CMD ["bash"]
