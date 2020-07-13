const assert = require('assert');
const sinon = require('sinon')
const EEPromParser = require('../src/modules/eeprom-serial')

describe('EEPromParser', () => {
  it('constructs', () => {
    new EEPromParser()
  })

  it('Parses a complete message correctly', () => {
    const data = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x41])
    const spy = sinon.spy()
    const parser = new EEPromParser()
    parser.on('data', spy)
    parser.write(data)
    assert.equal(spy.callCount, 1)

    result = spy.getCall(0).args[0]
    assert.equal(result.status, 0)
    assert.deepEqual(result.data, [0x41])
  })

  it('Parses two complete message correctly', () => {
    const data = Buffer.from([0x00, 0x02, 0x00, 0x02, 0x41, 0x42, 0x00, 0x01, 0x00, 0x01, 0x43])
    const spy = sinon.spy()
    const parser = new EEPromParser()
    parser.on('data', spy)
    parser.write(data)
    assert.equal(spy.callCount, 2)

    result = spy.getCall(0).args[0]
    assert.equal(result.status, 2)
    assert.deepEqual(result.data, [0x41, 0x42])

    result = spy.getCall(1).args[0]
    assert.equal(result.status, 1)
    assert.deepEqual(result.data, [0x43])
  })

  it('Parses a message with zero length', () => {
    const data = Buffer.from([0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x43])
    const spy = sinon.spy()
    const parser = new EEPromParser()
    parser.on('data', spy)
    parser.write(data)
    assert.equal(spy.callCount, 2)

    result = spy.getCall(0).args[0]
    assert.equal(result.status, 2)
    assert.deepEqual(result.data, [])

    result = spy.getCall(1).args[0]
    assert.equal(result.status, 1)
    assert.deepEqual(result.data, [0x43])
  })

})
