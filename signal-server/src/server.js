const express = require("express");
const { createServer } = require("https");
const { readFileSync } = require("fs");
const { nanoid } = require("nanoid");
const { resolve } = require("path");
const { WebSocketServer, OPEN } = require("ws");
const { Console } = require("console");

const app = express();
const appServer = createServer(
  {
    key: readFileSync(resolve(__dirname, "./../ssl/cert.key")),
    cert: readFileSync(resolve(__dirname, "./../ssl/cert.pem")),
  },
  app
).listen(3000);

app.use(express.static(resolve(__dirname, "./../public")));

const wsServer = createServer({
  key: readFileSync(resolve(__dirname, "./../ssl/cert.key")),
  cert: readFileSync(resolve(__dirname, "./../ssl/cert.pem")),
});

const wss = new WebSocketServer({ server: wsServer });

const handleJsonMessage = (socket, jsonMessage) => {
  switch (jsonMessage.type) {
    case "start":
      socket.id = nanoid();
      emitMessage(socket, { action: "start", id: socket.id });
      break;
    default:
      //  Default we will just relay the message to the peer
      if (!jsonMessage.data.remoteId) return;
      const remotePeerSocket = getSocketById(jsonMessage.data.remoteId);

      if (!remotePeerSocket) {
        return console.log(
          "failed to find remote socket with id",
          jsonMessage.data.remoteId
        );
      }
      //  delete/edit the remoteId depending if the action is offer or not
      if (jsonMessage.action !== "offer") {
        delete jsonMessage.data.remoteId;
      } else {
        jsonMessage.data.remoteId = socket.id;
      }
      emitMessage(remotePeerSocket, jsonMessage);
  }
};

wss.on("connection", (socket) => {
  console.log("New connection");

  socket.on("message", (data) => {
    console.log("socket::message data=%s", data);

    try {
      const jsonMessage = JSON.parse(data);
      handleJsonMessage(socket, jsonMessage);
    } catch (error) {
      console.log("failed to handle onmessage", error);
    }
  });

  socket.on("close", () => {
    console.log("socket::close");
  });
});

const emitMessage = (socket, jsonMessage) => {
  if (socket.readyState === OPEN) {
    socket.send(JSON.stringify(jsonMessage));
  }
};

// helper to get socket via id
const getSocketById = (socketId) => {
  return wss.clients.find((client) => client.id === socketId);
};

wsServer.listen(8888);
console.log("app server listening on port 3000");
console.log("wss server listening on port 8888");
