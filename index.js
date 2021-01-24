'use strict';
const {downloadTorrent} = require('./src/download');
const torrentParser = require('./src/torrent-parser');
console.log('inside index.js');
const torrent = torrentParser.open(process.argv[2]); // in the terminal we'll write something like node index.js /file/path/to/name-of-torrent.torrent
//console.log(torrent['announce-list'][1].toString('utf8'));
downloadTorrent(torrent,torrent.info.name);
