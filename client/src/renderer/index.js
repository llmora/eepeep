// Initial welcome page. Delete the following line to remove it.

'use strict';
const { dialog } = require("electron").remote;
const SerialPort = require('serialport')

require('../../node_modules/bootstrap/dist/css/bootstrap.min.css')

const styles = document.createElement('style');
styles.innerText = `@import url(https://unpkg.com/spectre.css/dist/spectre.min.css);.empty{display:flex;flex-direction:column;justify-content:center;height:100vh;position:relative}.footer{bottom:0;font-size:13px;left:50%;opacity:.9;position:absolute;transform:translateX(-50%);width:100%}`;
const vueScript = document.createElement('script');

var connected = false;
var vm;

function dump(serialPort, frequency, address, byteStart, byteEnd) {
  const port = new SerialPort(serialPort, {
    baudRate: 115200
  })

  // var msg = new Uint8Array(100);
  var msg = new Buffer(5);
  msg[0] = 'H';
  msg[1] = 'E';
  msg[2] = 'L';
  msg[3] = 'L';
  msg[4] = 'O';

  port.write(msg, 'binary', function(err) {
    if(err) {
      return console.log("Error sending message")
    }
    console.log("Message written successfully")
  })

  port.close()
//    ipcRenderer.send('form-submission', firstname)
}

vueScript.setAttribute('type', 'text/javascript'),
  vueScript.setAttribute('src', 'https://unpkg.com/vue'),
  vueScript.onload = init,
  document.head.appendChild(vueScript),
  document.head.appendChild(styles);

function init() {
  Vue.config.devtools = false,
    Vue.config.productionTip = false,
    vm = new Vue({

      data: {
        connected: false,
        ports: [],
        versions: {
          electron: process.versions.electron,
          electronWebpack: require('electron-webpack/package.json').version
        }
      },

      methods: {
        scan() {
        },

        //        open(b) { require('electron').shell.openExternal(b) },
        saveFile() {
          const savePath = dialog.showSaveDialog(null);
          console.log(savePath)
        },

      },

      template: `
      <body>
        <div id="container" class="container-fluid">

          <div class="row mt-4">
            <div class="col-xs-6 col-sm-6 col-md-6 col-lg-6 ">
              <form id="dumpForm">
                <div class="form-group">
                  <label for="serialport">Serial port</label>
                  <div class="input-group mb-2">
                    <select class="custom-select form-control" name="serialport" id="serialport" aria-describedby="serialportHelp" required>
                      <option v-for="port in ports" :value="port.name">{{ port.manufacturer? port.name + " [" + port.manufacturer + "]":port.name }}</option>
                    </select>

                    <div class="input-group-append">
                      <button class="btn-info" id="connectButton">{{ connected?"Disconnect":"Connect" }} </button>
                    </div>

                    </div>
                  <small id="serialportHelp" class="form-text text-muted">Select the serial port the Arduino is connected to</small>
                </div>

                <div class="form-group pt-2" v-if="connected">
                  <label for="frequency">I<sup>2</sup>C bus frequency</label>
                  <div class="input-group mb-2">
                    <input type="number" name="frequency" id="frequency" class="form-control" min="0" value="100" aria-describedby="frequencyHelp" required>
                    <div class="input-group-append">
                      <div class="input-group-text">kHz</div>
                    </div>
                  </div>
                  <small id="frequencyHelp" class="form-text text-muted">Devices can work at different frequencies, check the EEPROM datasheet for details, 100 / 400 kHz are good defaults</small>
                </div>

                <div class="form-group pt-2" v-if="connected">
                  <label for="address">I<sup>2</sup>C device address</label>
                  <div class="input-group mb-2">
                    <div class="input-group-prepend">
                      <div class="input-group-text">0x</div>
                    </div>
                    <input type="text" class="form-control" name="address" id="address" pattern="[a-fA-F\\d]+" aria-describedby="addressHelp" required>

                    <div class="input-group-append">
                      <button class="btn-info">Scan</button>
                    </div>
                  </div>
                  <small id="addressHelp" class="form-text text-muted">Each I<sup>2</sup>C device has a different address, check the EEPROM datasheet for the correct address. You can also click on 'Scan' to automatically identify connected devices</small>
                </div>

                <div class="form-row align-items-center" v-if="connected">
                  <div class="col-sm-5">
                    <label for="address">Memory start address</label>
                    <div class="input-group mb-2">
                      <div class="input-group-prepend">
                        <div class="input-group-text">0x</div>
                      </div>
                      <input type="text" class="form-control" name="byteStart" id="byteStart" pattern="[a-fA-F\\d]+" aria-describedby="byteStartHelp" value="0" required>
                    </div>
                  </div>
                  <div class="col-sm-1 align-middle align-center"><span class="align-center align-middle">-</span></div>
                  <div class="col-sm-5">
                    <label for="address">Memory end address</label>
                    <div class="input-group mb-2">
                      <div class="input-group-prepend">
                        <div class="input-group-text">0x</div>
                      </div>
                      <input type="text" class="form-control" name="byteEnd" id="byteEnd" pattern="[a-fA-F\\d]+" aria-describedby="byteEndHelp" required>
                    </div>
                  </div>
                </div>

                <div class="form-group mt-2 text-center" v-if="connected">
                  <button type="submit" class="btn btn-primary">Dump EEPROM contents</button>
                </div>
              </form>
            </div>
            <div class="col-xs-6 col-sm-6 col-md-6 col-lg-6">
              <div class="card" style="width: 18rem;">
                <div class="card-body">
                  <h5 class="card-title">Console output</h5>
                  <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>

              <!--button @click="open('https://webpack.electron.build')"class="btn btn-primary">Scan I<sup>2</sup>C bus</button>
              <button @click="saveFile()" class="btn btn-primary">Save file</button-->
        
        `,
        mounted: function() {
          var dumpForm = document.getElementById("dumpForm")
    
          dumpForm.addEventListener('submit', function(evt){
            evt.preventDefault();
            console.log("In submit event listener...")

            var serialPort = document.getElementById("serialport").value;
            var frequency = document.getElementById("frequency").value;
            var address = document.getElementById("address").value;
            var byteStart = document.getElementById("byteStart").value;
            var byteEnd = document.getElementById("byteEnd").value;

            dump(serialPort, frequency, address, byteStart, byteEnd)
          })

          var connectButton = document.getElementById("connectButton")
    
          connectButton.addEventListener('click', function(evt){
            evt.preventDefault();
            console.log("In connect click button...")

            vm.connected = !vm.connected;
          })

          SerialPort.list().then(
            ports => {
              var formPorts = []
              ports.forEach(port => {
                formPorts.push({name: port.path, manufacturer: port.manufacturer})
              })

              formPorts = formPorts.sort(function(a,b) {
                return a.manufacturer?a:a.name < b.name;
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
