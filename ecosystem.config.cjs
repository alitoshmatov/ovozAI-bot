module.exports = {
  apps: [
    {
      name: "voiceAI",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      max_restarts: 5,
      exp_backoff_restart_delay: 1000,
      time: true,
      env: {
        NODE_ENV: "production",
      },
      // Resource limitations
      node_args: "--max-old-space-size=100", // Limit Node.js memory to 256MB
      cpu: "25%", // Limit CPU usage to 25%
    },
  ],
};
