'use strict';
const fs = require('fs');
const net = require('net');
const Buffer = require('buffer').Buffer;
const tracker = require('./tracker');
const message = require('./message');
const Pieces = require('./pieces');
const Queue = require('./Queue');

const onWholeMsg = (socket, callback) => {
    let savedBuf = Buffer.alloc(0);
    let handshake = true;

  socket.on('data', recvBuf => {
    // msgLen calculates the length of a whole message
    const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
      callback(savedBuf.slice(0, msgLen()));
      savedBuf = savedBuf.slice(msgLen());
      handshake = false;
    }
  });
}

const downloadTorrent = (torrent,path) => {
    console.log('inside downloadTorrent');
    tracker.getPeers(torrent, peers => {
        const pieces = new Pieces(torrent);
        const file = fs.openSync(path, 'w');
        peers.forEach(peer => download(peer, torrent, pieces, file));
      });
}

const download = (peer, torrent, pieces,file) => {
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent));
    });
    const queue = new Queue(torrent);
    onWholeMsg(socket, msg => msgHandler(msg,socket, pieces, queue,torrent, file));
}

const msgHandler = (msg, socket,pieces,queue,torrent, file) => {
    if (isHandshake(msg)) {
        socket.write(message.buildInterested());
      } else {
        const m = message.parse(msg);
    
        if (m.id === 0) chokeHandler(socket);
        if (m.id === 1) unchokeHandler(socket, pieces, queue);
        if (m.id === 4) haveHandler(socket, pieces, queue, m.payload);
        if (m.id === 5) bitfieldHandler(socket, pieces, queue, m.payload);
        if (m.id === 7) pieceHandler(socket, pieces, queue, torrent, file, m.payload);
      }
}

const  chokeHandler = (socket) => {
    socket.end();
} 

const  unchokeHandler = (socket,pieces,queue) => {
    queue.choked = false;
    requestPiece(socket, pieces, queue);
}

const  haveHandler = (socket, pieces, queue, payload) => {
    const pieceIndex = payload.readUInt32BE(0);
    const queueEmpty = queue.length === 0;
    queue.queue(pieceIndex);
    if (queueEmpty) requestPiece(socket, pieces, queue);
} 

const bitfieldHandler = (socket, pieces, queue, payload) => {
    const queueEmpty = queue.length === 0;
    payload.forEach((byte, i) => {
        for (let j = 0; j < 8; j++) {
        if (byte % 2) queue.queue(i * 8 + 7 - j);
        byte = Math.floor(byte / 2);
        }
    });
    if (queueEmpty) requestPiece(socket, pieces, queue);

} 
const  pieceHandler = (socket, pieces, queue, torrent, file, pieceResp) => {
    console.log(pieceResp);
    pieces.addReceived(pieceResp);
  
    const offset = pieceResp.index * torrent.info['piece length'] + pieceResp.begin;
    fs.write(file, pieceResp.block, 0, pieceResp.block.length, offset, () => {});
  
    if (pieces.isDone()) {
      console.log('DONE!');
      socket.end();
      try { fs.closeSync(file); } catch(e) {}
    } else {
      requestPiece(socket,pieces, queue);
    }
}

const requestPiece = (socket, pieces, queue) => {
    if (queue.choked) return null;

    while (queue.queue.length) {
        const pieceBlock = queue.deque();
        if (pieces.needed(pieceBlock)) {
        socket.write(message.buildRequest(pieceBlock));
        pieces.addRequested(pieceBlock);
        break;
        }
    }
}

const isHandshake = (msg) => {
    return msg.length === msg.readUInt8(0) + 49 &&
    msg.toString('utf8', 1) === 'BitTorrent protocol';
}

module.exports = {downloadTorrent};