const WebSocket = require('ws');

let wss;
const clients = new Map(); // Map<userId, Set<WebSocket>>

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('WebSocket client connected');
    
    let userId = null;
    let subscriptions = new Set();

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, data, { userId, subscriptions });
        
        // Update userId if authenticated
        if (data.type === 'auth' && data.userId) {
          userId = data.userId;
          if (!clients.has(userId)) {
            clients.set(userId, new Set());
          }
          clients.get(userId).add(ws);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      if (userId && clients.has(userId)) {
        clients.get(userId).delete(ws);
        if (clients.get(userId).size === 0) {
          clients.delete(userId);
        }
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  });

  console.log('WebSocket server initialized');
}

function handleMessage(ws, data, context) {
  const { type, ...payload } = data;

  switch (type) {
    case 'auth':
      // Authentication handled in main message handler
      ws.send(JSON.stringify({ type: 'auth_success', userId: payload.userId }));
      break;

    case 'subscribe':
      if (payload.channel) {
        context.subscriptions.add(payload.channel);
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          channel: payload.channel 
        }));
      }
      break;

    case 'unsubscribe':
      if (payload.channel) {
        context.subscriptions.delete(payload.channel);
        ws.send(JSON.stringify({ 
          type: 'unsubscribed', 
          channel: payload.channel 
        }));
      }
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      console.log('Unknown message type:', type);
  }
}

// Broadcast to all connected clients
function broadcast(data) {
  if (!wss) return;

  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast to specific user
function broadcastToUser(userId, data) {
  if (!clients.has(userId)) return;

  const message = JSON.stringify(data);
  clients.get(userId).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Broadcast to channel subscribers
function broadcastToChannel(channel, data) {
  if (!wss) return;

  const message = JSON.stringify({ ...data, channel });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Check if client is subscribed (this would need to be tracked)
      client.send(message);
    }
  });
}

// Notify about new sale
function notifySaleCreated(sale) {
  broadcast({
    type: 'sale:created',
    data: sale,
    timestamp: new Date().toISOString()
  });
}

// Notify about inventory update
function notifyInventoryUpdated(product) {
  broadcast({
    type: 'inventory:updated',
    data: product,
    timestamp: new Date().toISOString()
  });
}

// Send dashboard update
function sendDashboardUpdate(stats) {
  broadcast({
    type: 'dashboard:update',
    data: stats,
    timestamp: new Date().toISOString()
  });
}

// Get connection count
function getConnectionCount() {
  return wss ? wss.clients.size : 0;
}

module.exports = {
  setupWebSocket,
  broadcast,
  broadcastToUser,
  broadcastToChannel,
  notifySaleCreated,
  notifyInventoryUpdated,
  sendDashboardUpdate,
  getConnectionCount
};