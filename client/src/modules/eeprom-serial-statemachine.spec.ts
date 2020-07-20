import * as assert from 'assert'
import * as sinon from 'sinon'
import { expect } from 'chai';

const { EEPromSerialParser } = require('./eeprom-serial-parser')
const { EEPromSerialStatemachine, StateMachine} = require('./eeprom-serial-statemachine')

describe('EEPromSerialStatemachine', () => {

  it('Initial state is disconnected', () => {
    const stateMachine = new EEPromSerialStatemachine(null, null)
    assert.equal(stateMachine.state, StateMachine.State.STATE_DISCONNECTED)
  })

  it('Scans for devices and notifies that nothing is found', () => {
    const spy = sinon.spy()
    const stateMachine = new EEPromSerialStatemachine(spy, null)
    stateMachine.scanning()

    const parser = new EEPromSerialParser()
    parser.on('data', stateMachine.dataReceived)

    const data = Buffer.from([0x00, StateMachine.Status.STATUS_OK, 0x00, 0x01, 0x41, // Notification that scan has started
                              0x00, StateMachine.Status.STATUS_SCAN_NOTFOUND, 0x00, 0x01, 0x41]) // Notification that no device found
    parser.write(data)

    assert.equal(spy.callCount, 1)
    assert.equal(stateMachine.state, StateMachine.State.STATE_CONNECTED)
  })

  it('Scans for devices and sends a list back with all found devices', () => {
    const spy = sinon.spy()
    const stateMachine = new EEPromSerialStatemachine(spy, null)
    stateMachine.scanning()

    const parser = new EEPromSerialParser()
    parser.on('data', stateMachine.dataReceived)

    const data = Buffer.from([0x00, StateMachine.Status.STATUS_OK, 0x00, 0x01, 0x41, // Notification that scan has started
                              0x00, StateMachine.Status.STATUS_SCAN_RESULT, 0x00, 0x80, // Results of the scan with 64 devices found
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                              0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 
                            ]) // Notification that no device found
    parser.write(data)

    assert.equal(spy.callCount, 65)
    assert.equal(stateMachine.state, StateMachine.State.STATE_CONNECTED)
  })

  it('An EEPROM dump is successfully completed', () => {
    const spylog = sinon.spy()
    const spydata = sinon.spy()
    const stateMachine = new EEPromSerialStatemachine(spylog, spydata)
    stateMachine.state = StateMachine.State.STATE_DUMPING;

    const parser = new EEPromSerialParser()
    parser.on('data', stateMachine.dataReceived)

    const data = Buffer.from([0x00, StateMachine.Status.STATUS_OK,   0x00, 0x03, 0x41, 0x42, 0x43,
                              0x00, StateMachine.Status.STATUS_DUMP, 0x00, 0x10, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F])
    parser.write(data)

    assert.equal(spylog.callCount, 2)
    assert.equal(spydata.callCount, 1)

    var result = spydata.getCall(0).args[0]
    assert.deepEqual(result, [0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D, 0x3E, 0x3F])

    assert.equal(stateMachine.state, StateMachine.State.STATE_CONNECTED)
  })

  it('If an error is hit during dumping, go back to connected state', () => {
    const stateMachine = new EEPromSerialStatemachine(null, null)
    const parser = new EEPromSerialParser()
    parser.on('data', stateMachine.dataReceived)

    stateMachine.state = StateMachine.State.STATE_DUMPING;
    let data = Buffer.from([0x00, StateMachine.Status.STATUS_ERROR_PARAMETERS, 0x00, 0x00])
    parser.write(data)
    assert.equal(stateMachine.state, StateMachine.State.STATE_CONNECTED)
 
    stateMachine.state = StateMachine.State.STATE_DUMPING;
    data = Buffer.from([0x00, StateMachine.Status.STATUS_ERROR_COMMAND, 0x00, 0x00])
    parser.write(data)
    assert.equal(stateMachine.state, StateMachine.State.STATE_CONNECTED)
  })

})
