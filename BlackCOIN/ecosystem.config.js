module.exports = {
  apps: [{
    name: 'blackcoin-seed',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
      HTTP_PORT: 3001,
      P2P_PORT: 6001,
      DATA_DIR: '/var/lib/blackcoin/data',
      CONFIG_PATH: '/etc/blackcoin/config.json',
      LOG_LEVEL: 'info',
    },
    error_file: '/var/log/blackcoin/error.log',
    out_file: '/var/log/blackcoin/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
