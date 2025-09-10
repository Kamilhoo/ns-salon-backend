module.exports = {
    apps: [
      {
        name: "salon-backend",              
        script: "server.js",                 
        instances: 1,                      
        exec_mode: "fork",                  
        watch: false,                       
        autorestart: true,                  
        max_memory_restart: "1G",     
        env: {
          NODE_ENV: "production",
        },
      },
    ],
  };
  