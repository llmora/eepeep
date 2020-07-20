'use strict';
const { dialog } = require("electron").remote;
const SerialPort = require('serialport')
const log = require('electron-log');
const window = require('electron').BrowserWindow;
const fs = require('fs');

const { EEPromSerialParser } = require('../modules/eeprom-serial-parser')
const { EEPromSerialStatemachine, StateMachine } = require('../modules/eeprom-serial-statemachine')

import * as Vue from "vue"

require('../../node_modules/bootstrap/dist/css/bootstrap.min.css')

// Enums and structs

enum CommandCode {
  COMMAND_DUMP = 0,
  COMMAND_SCAN = 1
}

interface ClientCommand {
  command: CommandCode;
  i2cAddress: number;
  frequency: number;
  startByte: number;
  endByte: number;
}

const saveFile = async(data) => {

  // From https://stackoverflow.com/questions/1531093/how-do-i-get-the-current-date-in-javascript
  var today = new Date();
  var day = String(today.getDate()).padStart(2, '0');
  var month = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var year = today.getFullYear();
  var ymd = year + month + day;

  const options = { defaultPath: 'eeprom-' + ymd}

  const result = await dialog.showSaveDialog(null, options)

  if(! result.canceled) {
    fs.writeFile(result.filePath, Buffer.from(data), (err) => {
      if (err) {
        logMessage(1, "Error saving EEPROM dump: " + err.message);
      } else {
        logMessage(0, "EEPROM successfully saved to " + result.filePath)
      }
    })
  }
}


// Vue initialisation

const styles = document.createElement('style');
styles.innerText = // `@import url(https://unpkg.com/spectre.css/dist/spectre.min.css);.empty{display:flex;flex-direction:column;justify-content:center;height:100vh;position:relative}.footer{bottom:0;font-size:13px;left:50%;opacity:.9;position:absolute;transform:translateX(-50%);width:100%}
`
.output {
  overflow-y: scroll;
  height: 80vh;
  background-color: black;
  margin-left: 2em;
}

.level-0 {
  color: #aaaaaa;
}

.level-1 {
  color: #dd0000;
}

.level-2 {
  color: #008800;
}

pre.bash {
  overflow-x: auto;
  white-space: pre-wrap;
  white-space: -moz-pre-wrap;
  white-space: -pre-wrap;
  white-space: -o-pre-wrap;
  word-wrap: break-word;

  margin-bottom: 0;
  margin: 0;

  font-size: small ; 
  font-family: Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace;
  width: 100%;
  display: inline-block;
}
`

const vueScript = document.createElement('script');

var port = null;
var vm;
var state = StateMachine.State.STATE_DISCONNECTED;
const stateMachine = new EEPromSerialStatemachine(logMessage, saveFile, stateChange)

vueScript.setAttribute('type', 'text/javascript'),
  vueScript.setAttribute('src', 'https://unpkg.com/vue'),
  vueScript.onload = init,
  document.head.appendChild(vueScript),
  document.head.appendChild(styles);

function init() {

  Vue.default.config.devtools = false,
    Vue.default.config.productionTip = false,
    vm = new Vue.default({

      data: {
        connected: false,
        ports: [],
        versions: {
          electron: process.versions.electron,
          electronWebpack: require('electron-webpack/package.json').version
        }
      },

      template: `
      <body>
        <div id="container" class="container-fluid">

          <div class="row mt-4">
            <div class="col-xs-6 col-sm-6 col-md-6 col-lg-6 ">
              <form id="dumpForm">
                <div class="form-group">
                  <label for="serialport">Serial port</label>
                  <div class="input-group mb-2 input-group-sm">
                    <select class="custom-select form-control" name="serialport" id="serialport" aria-describedby="serialportHelp" required>
                      <option v-for="port in ports" :value="port.name">{{ port.manufacturer? port.name + " [" + port.manufacturer + "]":port.name }}</option>
                    </select>

                    <div class="input-group-append">
                      <button class="btn-info" id="connectButton">{{ connected?"Disconnect":"Connect" }} </button>
                    </div>

                    </div>
                  <small id="serialportHelp" class="form-text text-muted">Select the serial port the Arduino is connected to</small>
                </div>

                <div class="form-group pt-2" v-show="connected">
                  <label for="frequency">I<sup>2</sup>C bus frequency</label>
                  <div class="input-group mb-2 input-group-sm">
                    <input type="number" name="frequency" id="frequency" class="form-control" min="0" value="100" aria-describedby="frequencyHelp" required>
                    <div class="input-group-append">
                      <div class="input-group-text">kHz</div>
                    </div>
                  </div>
                  <small id="frequencyHelp" class="form-text text-muted">Devices can work at different frequencies, check the EEPROM datasheet for details, 100 / 400 kHz are good defaults</small>
                </div>

                <div class="form-group pt-2" v-show="connected">
                  <label for="address">I<sup>2</sup>C device address</label>
                  <div class="input-group mb-2 input-group-sm">
                    <div class="input-group-prepend">
                      <div class="input-group-text">0x</div>
                    </div>
                    <input type="text" class="form-control" name="address" id="address" pattern="[a-fA-F\\d]+" aria-describedby="addressHelp" required>

                    <div class="input-group-append">
                      <button class="btn-info" id="scanButton">Scan</button>
                    </div>
                  </div>
                  <small id="addressHelp" class="form-text text-muted">Each I<sup>2</sup>C device has a different address, check the EEPROM datasheet for the correct address. You can also click on 'Scan' to automatically identify connected devices</small>
                </div>

                <div class="form-row align-items-center" v-show="connected">
                  <div class="col-sm-5">
                    <label for="address">Memory start address</label>
                    <div class="input-group mb-2 input-group-sm">
                      <div class="input-group-prepend">
                        <div class="input-group-text">0x</div>
                      </div>
                      <input type="text" class="form-control" name="byteStart" id="byteStart" pattern="[a-fA-F\\d]+" aria-describedby="byteStartHelp" value="0" required>
                    </div>
                  </div>
                  <div class="col-sm-1 align-middle align-center"><span class="align-center align-middle">-</span></div>
                  <div class="col-sm-5">
                    <label for="address">Memory end address</label>
                    <div class="input-group mb-2 input-group-sm">
                      <div class="input-group-prepend">
                        <div class="input-group-text">0x</div>
                      </div>
                      <input type="text" class="form-control" name="byteEnd" id="byteEnd" pattern="[a-fA-F\\d]+" aria-describedby="byteEndHelp" required>
                    </div>
                  </div>
                </div>

                <div class="form-group mt-2 text-center" v-show="connected">
                  <button type="submit" class="btn btn-primary">Dump EEPROM contents</button>
                </div>
              </form>
            </div>
            <div class="col-xs-6 col-sm-6 col-md-6 col-lg-6">
              <div class="output mb-0 pl-2" id="logs-container">
              </div>
            </div>
          </div>
        </div>
      </body>

              <!--button @click="open('https://webpack.electron.build')"class="btn btn-primary">Scan I<sup>2</sup>C bus</button>
              <button @click="saveFile()" class="btn btn-primary">Save file</button-->
        
        `,
      mounted: function () {

        var dumpForm = document.getElementById("dumpForm")

        dumpForm.addEventListener('submit', function (evt) {
          evt.preventDefault();

          var frequency = (<HTMLInputElement>document.getElementById("frequency")).value;
          var address = (<HTMLInputElement>document.getElementById("address")).value;
          var byteStart = (<HTMLInputElement>document.getElementById("byteStart")).value;
          var byteEnd = (<HTMLInputElement>document.getElementById("byteEnd")).value;

          dump(frequency, parseInt(address, 16), parseInt(byteStart, 16), parseInt(byteEnd, 16))
        })

        var connectButton = document.getElementById("connectButton")

        connectButton.addEventListener('click', function (evt) {
          evt.preventDefault();

          if (!vm.connected) {
            var serialPort = (<HTMLInputElement>document.getElementById("serialport")).value;

            port = new SerialPort(serialPort, {
              baudRate: 115200
            })

            port.on('open', function () {
              logMessage(0, "Successfully opened port \'" + port.path + "\'")

              const parser = new EEPromSerialParser()
              port.pipe(parser)
              parser.on('data', stateMachine.dataReceived)
            })

            port.on('error', function (evt) {
              logMessage(1, "Error opening port \'" + port.path + "\': " + evt)
              stateMachine.disconnected()
            })

          } else {
            port.close()

            stateMachine.disconnected()
            logMessage(0, "Serial port disconnected")
          }

        })

        var scanButton = document.getElementById("scanButton")

        scanButton.addEventListener('click', function (evt) {
          evt.preventDefault();
          scan()
        })

        SerialPort.list().then(
          ports => {
            var formPorts = []
            ports.forEach(port => {
              formPorts.push({ name: port.path, manufacturer: port.manufacturer })
            })

            formPorts = formPorts.sort(function (a, b) {
              return a.manufacturer ? a : a.name < b.name;
            });

            vm.ports = formPorts;
          },
          err => {
            console.error('Error listing ports', err)
          }
        )

      }
    },

    ).$mount('#app')
}

// Functions

function sendMessage(cmd: ClientCommand) {

  var msg = Buffer.alloc(8)

  // byte command;            // 8-bit, command type
  // byte i2c_address;        // 8-bit, address of the i2c eeprom device to dump
  // unsigned int frequency;  // 16-bit, frequency of the i2c eeprom device to dump (in kHz)
  // unsigned int start_byte; // 16-bit, first memory address to dump
  // unsigned int end_byte;   // 16-bit, last memory address byte to dump

  msg.writeUInt8(cmd.command, 0)
  msg.writeUInt8(cmd.i2cAddress, 1)
  msg.writeUInt16BE(cmd.frequency, 2)
  msg.writeUInt16BE(cmd.startByte, 4)
  msg.writeUInt16BE(cmd.endByte, 6)

  port.write(msg, 'binary', function (err) {
    if (err) {
      log.error("Error sending command to device")
    } else {
      log.debug("Command successfully sent")
    }
  })
}

function scan() {

  log.debug("Sending SCAN command");

  const scanCommand: ClientCommand = {
    command: CommandCode.COMMAND_SCAN,
    i2cAddress: 0,
    frequency: 0,
    startByte: 0,
    endByte: 0
  }

  logMessage(0, "Starting i2c bus scan")
  stateMachine.scanning();

  sendMessage(scanCommand)
}

function dump(frequency, address, startByte, endByte) {

  log.debug("Sending DUMP command");

  const scanCommand: ClientCommand = {
    command: CommandCode.COMMAND_DUMP,
    i2cAddress: address,
    frequency: frequency,
    startByte: startByte,
    endByte: endByte
  }

  logMessage(0, "Starting EEPROM dump")
  stateMachine.dumping();

  sendMessage(scanCommand)
}

function logMessage(status: number, msg: string) {

  var logsContainer = document.getElementById("logs-container");

  if (logsContainer) {
    logsContainer.innerHTML += "<pre class=\"bash level-" + status + "\">" + msg + "</pre>"
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }
}

function stateChange(state: number) {

  if (vm) {
    if (state != StateMachine.State.STATE_DISCONNECTED) {
      vm.connected = true;
    } else {
      vm.connected = false;
    }
  }
}
