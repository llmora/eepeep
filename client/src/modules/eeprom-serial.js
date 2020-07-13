const { Transform } = require('stream')

/**
 * Parse the EEPROM dumper protocol
 * @extends Transform
 * @summary A transform stream that emits EEPROM dumper response as they are received.
 * @example
const SerialPort = require('serialport')
const EEProm = require('eeprom-serial')
const port = new SerialPort('/dev/ttyUSB0')
const parser = port.pipe(new EEProm())
parser.on('data', console.log)
*/

const STATE_START = 0
const STATE_STATUS_READ = 1
const STATE_LENGTH_READ = 2
const STATE_DATA_READ = 3

class EEPromParser extends Transform {
  constructor() {
    super({ readableObjectMode: true })

    this.resetStatus()

    this.pendingData = []
  }

  resetStatus() {
    this.state = STATE_START
    this.status = -1;
    this.length = -1;
    this.data = [];
  }

  _transform(chunk, _, cb) {

    Array.from(chunk).map(byte => this.pendingData.push(byte))

//     console.log(this.pendingData)

    while (this.pendingData.length) {
      switch (this.state) {

        case STATE_START:
          if (this.pendingData.length >= 2) {
            this.status = (this.pendingData[0] << 8) + this.pendingData[1];
            this.state = STATE_STATUS_READ;
            this.pendingData.splice(0, 2);
          } else {
            continue;
          }
          break;

        case STATE_STATUS_READ:
          if (this.pendingData.length >= 2) {
            this.length = (this.pendingData[0] << 8) + this.pendingData[1];
            this.state = STATE_LENGTH_READ;
            this.pendingData.splice(0, 2);
          } else {
            continue;
          }
          break;

        case STATE_LENGTH_READ:
          if (this.pendingData.length >= this.length) {
            this.data = this.pendingData.slice(0, this.length)
            this.state = STATE_DATA_READ;
            this.pendingData.splice(0, this.length);
          } else {
            continue;
          }
          break;
      }

      if ((this.state == STATE_DATA_READ) || (this.state == STATE_LENGTH_READ && this.length == 0)) {
        this.push({ status: this.status, data: this.data })
        this.resetStatus()
      }
    }

    cb()
  }
}

module.exports = EEPromParser
