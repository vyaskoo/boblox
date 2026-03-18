import { WebSocketServer } from "ws";

const port = Number(process.env.PORT || 8787);
const wss = new WebSocketServer({ port });
const clients = new Map();

function roomPeers(room) {
  if (!clients.has(room)) {
    clients.set(room, new Set());
  }
  return clients.get(room);
}

function removeFromRooms(socket) {
  for (const peers of clients.values()) {
    peers.delete(socket);
  }
}

wss.on("connection", (socket) => {
  socket.meta = { room: null, id: null };

  socket.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (data.type === "join") {
      removeFromRooms(socket);
      socket.meta.room = String(data.room || "main");
      socket.meta.id = String(data.id || "");
      roomPeers(socket.meta.room).add(socket);
      socket.send(JSON.stringify({ type: "joined", room: socket.meta.room }));
      return;
    }

    if (!socket.meta.room) return;
    const peers = roomPeers(socket.meta.room);
    for (const peer of peers) {
      if (peer !== socket && peer.readyState === peer.OPEN) {
        peer.send(JSON.stringify(data));
      }
    }
  });

  socket.on("close", () => {
    removeFromRooms(socket);
  });
});

console.log(`Boblox WS relay listening on :${port}`);
