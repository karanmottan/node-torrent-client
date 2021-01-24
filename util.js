'use strict';

const { Buffer } = require('buffer');
const crypto = require('crypto');

let id = null;

const genId = () => {
    if(!id){
        id = crypto.randomBytes(20);
        Buffer.from('-KM0001-').copy(id,0);
    }
    return id;
}

console.log(genId());

module.exports = {genId};