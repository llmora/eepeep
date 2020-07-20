const { Transform } = require('stream')
const { EEPromSerialParser } = require('./eeprom-serial-parser')

const log = require('electron-log');

export namespace StateMachine {
  export enum State {
    STATE_DISCONNECTED = 0,
    STATE_CONNECTED = 1,
    STATE_DUMPING = 2,
    STATE_SCANNING = 3
  }

  export enum Status {
    STATUS_OK = 0,
    STATUS_ERROR_PARAMETERS = 1,
    STATUS_ERROR_COMMAND = 2,
    STATUS_SCAN_RESULT = 3,
    STATUS_SCAN_NOTFOUND = 4,
    STATUS_DUMP = 5,
    STATUS_READY = 6,
    STATUS_LOG = 7,
    STATUS_ERROR_DUMP = 8
  }
}

class EEPromSerialStatemachine {

  state: StateMachine.State;
  logCallback: (status: number, message: string) => void;
  stateChangeCallback: (state: StateMachine.State) => void;
  saveFileCallback: any;

  constructor(logCallback, saveFileCallback, stateChangeCallback) {
    this.logCallback = logCallback;
    this.saveFileCallback = saveFileCallback;
    this.stateChangeCallback = stateChangeCallback;

    this.state = StateMachine.State.STATE_DISCONNECTED;
  }

  logMessage(status: number, message: string): void {
    if (this.logCallback) {
      this.logCallback(status, message)
    }
  }

  saveFile(data): void {
    if (this.saveFileCallback) {
      this.saveFileCallback(data)
    }
  }

  stateChange(state: StateMachine.State) {
    this.state = state;

    if (this.stateChangeCallback) {
      this.stateChangeCallback(state)
    }
  }

  disconnected() {
    this.stateChange(StateMachine.State.STATE_DISCONNECTED);
  }

  scanning() {
    this.stateChange(StateMachine.State.STATE_SCANNING);
  }

  dumping() {
    this.stateChange(StateMachine.State.STATE_DUMPING);
  }

  private dataReceived = (msg) => {

    log.debug(`STATE: ${this.state} - State machine received data:`)
    log.debug(msg)

    if (msg.status == StateMachine.Status.STATUS_LOG) {
      this.logMessage(2, this.bin2String(msg.data))
    } else {
      switch (this.state) {
        case StateMachine.State.STATE_DISCONNECTED:
          switch (msg.status) {

            case StateMachine.Status.STATUS_READY: // Received the message to indicate that the dump is starting
              this.logMessage(0, "Device firmware ready")
              this.stateChange(StateMachine.State.STATE_CONNECTED)
              break;

            default:
              this.logMessage(1, "Invalid message received, check your device firmware")
              break;
          }
          break;

        case StateMachine.State.STATE_DUMPING:
          switch (msg.status) {

            case StateMachine.Status.STATUS_OK: // Received the message to indicate that the dump is starting
              this.logMessage(0, this.bin2String(msg.data))
              break;

            case StateMachine.Status.STATUS_DUMP: // Received the EEPROM contents
              this.logMessage(0, "EEPROM dump completed, saving file")
              this.saveFile(msg.data)
              this.stateChange(StateMachine.State.STATE_CONNECTED);
              break;

            case StateMachine.Status.STATUS_ERROR_DUMP:
              this.logMessage(1, "Error dumping EEPROM: EEPROM not responding, check address and connections")
              this.stateChange(StateMachine.State.STATE_CONNECTED);
              break;

            case StateMachine.Status.STATUS_ERROR_PARAMETERS:
              this.logMessage(1, "Error dumping EEPROM: Invalid parameters")
              this.stateChange(StateMachine.State.STATE_CONNECTED);
              break;

            case StateMachine.Status.STATUS_ERROR_COMMAND:
              this.logMessage(1, "Error dumping EEPROM: Invalid command received")
              this.stateChange(StateMachine.State.STATE_CONNECTED);
              break;

            default:
              break;
          }

          break;

        case StateMachine.State.STATE_SCANNING:
          switch (msg.status) {

            case StateMachine.Status.STATUS_SCAN_RESULT:
              // Show all the scanned devices in the console
              this.logMessage(0, "Scan completed successfully")

              let devices = Array.from(msg.data)

              if (devices.length == 128) {
                for (let i = 0; i < devices.length; i++) {
                  if (devices[i] == 49) { // '1'
                    this.logMessage(0, "Node found at address 0x" + i.toString(16))
                    // TODO: Add the node to a drop-down?
                  }
                }
              } else {
                this.logMessage(1, "Error in scanning response, check your device connection")
              }

              this.stateChange(StateMachine.State.STATE_CONNECTED);

              break;

            case StateMachine.Status.STATUS_SCAN_NOTFOUND:
              this.logMessage(1, "No connected device found")
              this.stateChange(StateMachine.State.STATE_CONNECTED);
              break;

            default:
              break;
          }
          break;

        default:
          this.logMessage(1, "Unknown state, results may be unexpected")
          break;
      }

    }
  }

  // From: https://stackoverflow.com/questions/3195865/converting-byte-array-to-string-in-javascript
  private bin2String(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
      result += String.fromCharCode(parseInt(array[i]));
    }
    return result;
  }
  
};

module.exports = { EEPromSerialStatemachine, StateMachine }
