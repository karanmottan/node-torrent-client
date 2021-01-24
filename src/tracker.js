'use strict'
const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const crypto = require('crypto'); // to be used to generate the random 4-byte buffer at the end of UDP connection request 
const torrentParser = require('./torrent-parser'); // torrent-parser to get the info out of the torrent file
const util = require('../util'); // util to generate an id to uniquely identify the client

//function to send UDP request
const udpSend = (socket,message, rawUrl, callback = () => {}) => {
    console.log('inside udp send');
    const url = urlParse(rawUrl);
    console.log(url.host);
    socket.send(message, 0, message.length, url.port, url.hostname, callback);
}

//function to build the connection request
const buildConnectReq = () => {
    console.log('buildConnectReq');
    const buff = Buffer.alloc(16); // the entire message is 16 bytes

    buff.writeInt32BE(0x417, 0);
    buff.writeUInt32BE(0x27101980, 4);
    buff.writeUInt32BE(0, 8);
    crypto.randomBytes(4).copy(buff, 12);

    return buff;
}

//function to build the announce request
const buildAnnounceReq = (connId, torrent, port=6969) => {
  console.log('inside buildAnnounceReq');  
  const buff = Buffer.allocUnsafe(98);

  // connection id
  connId.copy(buff, 0);
  // action
  buff.writeUInt32BE(1, 8);
  // transaction id
  crypto.randomBytes(4).copy(buff, 12);
  // info hash
  torrentParser.infoHash(torrent).copy(buff, 16);
  // peerId
  util.genId().copy(buff, 36);
  // downloaded
  Buffer.alloc(8).copy(buff, 56);
  // left
  torrentParser.size(torrent).copy(buff, 64);
  // uploaded
  Buffer.alloc(8).copy(buff, 72);
  // event
  buff.writeUInt32BE(0, 80);
  // ip address
  buff.writeUInt32BE(0, 84);
  // key
  crypto.randomBytes(4).copy(buff, 88);
  // num want
  buff.writeInt32BE(-1, 92);
  // port
  buff.writeUInt16BE(port, 96);

  return buff;

}


//function to parse the connection request
const parseConnectReq = (resp) => {
    console.log('inside parseConnectResp');
    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        connectionId: resp.slice(8)
      }
}

//function to parse the announce request
const parseAnnounceReq = (resp) => {
    console.log('inside parseAnnounceResp');
    const group = (iterable, groupSize) => {
        let groups = [];
        for (let i = 0; i < iterable.length; i += groupSize) {
        groups.push(iterable.slice(i, i + groupSize));
        }
        return groups;
    }
    return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        leechers: resp.readUInt32BE(8),
        seeders: resp.readUInt32BE(12),
        peers: group(resp.slice(20), 6).map(address => {
          return {
            ip: address.slice(0, 4).join('.'),
            port: address.readUInt16BE(4)
          }
        })
    }
}

//function to get the response type

const responseType = (resp) => {
    console.log('inside responseType');
    const action = resp.readUInt32BE(0);
    if (action === 0) return 'connect';
    if (action === 1) return 'announce';
}

const getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4');
    const url = torrent['announce-list'][4].toString('utf8');
    console.log('inside getPeers');
    //sending connection request
    udpSend(socket, buildConnectReq(), url);

    socket.on('message', response => {
        console.log('received response' , response);
        if (responseType(response) === 'connect') {
          // 2. receive and parse connect response
          const connResp = parseConnectReq(response);
          // 3. send announce request
          const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
          udpSend(socket, announceReq, url);
        } else if (responseType(response) === 'announce') {
          // 4. parse announce response
          const announceResp = parseAnnounceReq(response);
          // 5. pass peers to callback
          callback(announceResp.peers);
        }
      });
}



//exporting the getPeers function
module.exports = {getPeers};