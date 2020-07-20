const { Transform } = require('stream')
const log = require('electron-log');

/**
 * Parse the EEPROM dumper protocol
 * @extends Transform
 * @summary A transform stream that emits EEPROM dumper response as they are received.
 * @example
const SerialPort = require('serialport')
const { EEPromSerialParser } = require('eeprom-serial-parser')
const port = new SerialPort('/dev/ttyUSB0')
const parser = port.pipe(new EEPromSerialParser())
parser.on('data', console.log)
*/

export namespace EEPromSerialParserState {
  export enum State {
    STATE_START = 0,
    STATE_STATUS_READ = 1,
    STATE_LENGTH_READ = 2,
    STATE_DATA_READ = 3
  }
}

class EEPromSerialParser extends Transform {

  constructor() {
    super({ readableObjectMode: true })

    this.resetStatus()

    this.pendingData = []
  }

  resetStatus() {
    this.state = EEPromSerialParserState.State.STATE_START
    this.status = -1;
    this.length = -1;
    this.data = [];
  }

  _transform(chunk, encoding, cb) {

    log.debug(`STATE: ${this.state} - Received chunk of length ${chunk.length}`);
    log.debug(chunk)

    Array.from(chunk).map(byte => this.pendingData.push(byte))

    var continueParsing = true;

    while (this.pendingData.length && continueParsing) {
      switch (this.state) {

        case EEPromSerialParserState.State.STATE_START:
          if (this.pendingData.length >= 2) {
            this.status = (this.pendingData[0] << 8) + this.pendingData[1];
            this.state = EEPromSerialParserState.State.STATE_STATUS_READ;
            this.pendingData.splice(0, 2);
          } else {
            continueParsing = false;
            continue;
          }
          break;

        case EEPromSerialParserState.State.STATE_STATUS_READ:
          if (this.pendingData.length >= 2) {
            this.length = (this.pendingData[0] << 8) + this.pendingData[1];

            log.debug(`Received length: ${this.length}`);
            this.state = EEPromSerialParserState.State.STATE_LENGTH_READ;
            this.pendingData.splice(0, 2);
          } else {
            continueParsing = false;
            continue;
          }
          break;

        case EEPromSerialParserState.State.STATE_LENGTH_READ:
          if (this.pendingData.length >= this.length) {
            this.data = this.pendingData.slice(0, this.length)
            this.state = EEPromSerialParserState.State.STATE_DATA_READ;
            this.pendingData.splice(0, this.length);
          } else {
            continueParsing = false;
            continue;
          }
          break;
      }

      if ((this.state == EEPromSerialParserState.State.STATE_DATA_READ) || (this.state == EEPromSerialParserState.State.STATE_LENGTH_READ && this.length == 0)) {
        this.push({ status: this.status, data: this.data })
        this.resetStatus()
      }
    }

    cb()
  }
}

module.exports = { EEPromSerialParser } 
