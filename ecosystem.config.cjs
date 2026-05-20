// PM2 process configuration for AlgoTick dev.
// Usage:
//   pm2 start ecosystem.config.cjs    # 두 앱 동시 기동
//   pm2 logs                          # 통합 로그
//   pm2 logs algotick-server          # 개별
//   pm2 restart all                   # 둘 다 재시작
//   pm2 stop all                      # 정지
//   pm2 delete all                    # 등록 해제

module.exports = {
  apps: [
    {
      name: 'algotick-server',
      cwd: './packages/server',
      script: 'npm',
      args: 'run dev',
      // tsx watch 자체가 파일 감시 — pm2 watch 비활성
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'algotick-client',
      cwd: './packages/client',
      script: 'npm',
      args: 'run dev',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'development' },
    },
  ],
};
