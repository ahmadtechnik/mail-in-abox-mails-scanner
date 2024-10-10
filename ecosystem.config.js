module.exports = {
  apps: [
    {
      name: 'MailFilesReader',
      script: 'nodemon',
      args: 'app.js',
      watch: true,
      exec_mode: 'fork',
      interpreter: 'node',
      autorestart: true,
    },
  ],
};