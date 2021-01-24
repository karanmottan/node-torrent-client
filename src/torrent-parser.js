'use strict'
const fs = require('fs');
const bencode = require('bencode');
const bignum = require('bignum');
const crypto = require("crypto");

const BLOCK_LEN = Math.pow(2,14);

const pieceLen = (torrent, pieceIndex) => {
    const totalLength = bignum.fromBuffer(size(torrent)).toNumber();
    const pieceLength = torrent.info['piece length'];
  
    const lastPieceLength = totalLength % pieceLength;
    const lastPieceIndex = Math.floor(totalLength / pieceLength);
  
    return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength;
}
 
const blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex);
    return Math.ceil(pieceLength / BLOCK_LEN);
}

const blockLen = (torrent, pieceIndex, blockIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex);
  
    const lastPieceLength = pieceLength % BLOCK_LEN;
    const lastPieceIndex = Math.floor(pieceLength / BLOCK_LEN);
  
    return blockIndex === lastPieceIndex ? lastPieceLength : BLOCK_LEN;
}

const open = (filepath) => {
    console.log('inside open');
    return bencode.decode(fs.readFileSync(filepath));
}

const size = (torrent) => {
    const size = torrent.info.files ?
    torrent.info.files.map(file => file.length).reduce((a, b) => a + b) :
    torrent.info.length;

    return bignum.toBuffer(size, {size: 8});
}

const infoHash = (torrent) => {
    const info = bencode.encode(torrent.info);
    return crypto.createHash('sha1').update(info).digest();
}

module.exports = {open, size, infoHash, BLOCK_LEN , pieceLen, blocksPerPiece, blockLen};