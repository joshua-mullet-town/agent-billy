import * as http from 'http';
import { AgentBilly } from '../core/agentBilly';

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Set CORS headers for web access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    try {
      const billy = new AgentBilly();
      const status = await billy.getStatus();
      
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        agent: {
          canTakeWork: status.canTakeWork,
          currentTasks: status.currentTasks.length,
          stats: status.stats
        }
      }, null, 2));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, null, 2));
    }
  } else if (req.url === '/') {
    res.statusCode = 200;
    res.end(JSON.stringify({
      message: 'Agent Billy is running',
      endpoints: {
        health: '/health'
      },
      timestamp: new Date().toISOString()
    }, null, 2));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({
      error: 'Not found',
      timestamp: new Date().toISOString()
    }, null, 2));
  }
});

server.listen(port, () => {
  console.log(`🏥 Billy health server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});

export default server;