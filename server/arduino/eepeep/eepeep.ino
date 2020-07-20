/*
 * 
 * 
 * Scanning code based on https://playground.arduino.cc/Main/I2cScanner/
 */

#include <Wire.h>

#define ENDIAN(x) (x >> 8) | (x << 8)

#define MAX_I2C_ADDRESS 128

#define STATUS_OK 0
#define STATUS_ERROR_PARAMETERS 1
#define STATUS_ERROR_COMMAND 2
#define STATUS_SCAN_RESULT 3
#define STATUS_SCAN_NOTFOUND 4
#define STATUS_DUMP 5
#define STATUS_READY 6
#define STATUS_LOG 7
#define STATUS_ERROR_DUMP 8

#define MSG_DUMP_STARTING "Dump starting"

#define COMMAND_DUMP 0
#define COMMAND_SCAN 1

typedef struct
{
  byte command;            // 8-bit, command type
  byte i2c_address;        // 8-bit, address of the i2c eeprom device to dump
  unsigned int frequency;  // 16-bit, frequency of the i2c eeprom device to dump (in kHz)
  unsigned int start_byte; // 16-bit, first memory address to dump
  unsigned int end_byte;   // 16-bit, last memory address byte to dump
} client_command;

typedef struct
{
  unsigned int status; // 16-bit, status of response
  unsigned int length; // 16-bit, length of content
} server_command;

void setup()
{
  Serial.begin(115200);
  Wire.begin();
  delay(1000);

  sendMessage(STATUS_READY, "EEPROM v1.0 dumper ready");
}

void loop()
{
  client_command cmd;
  byte scanned_device_addresses[MAX_I2C_ADDRESS];

  // Read command from the client

  if (readCommand(&cmd) == 0)
  {

    switch (cmd.command)
    {
    case COMMAND_DUMP:
      dump(&cmd);
      break;

    case COMMAND_SCAN:

      Wire.setClock(cmd.frequency * 1000);

      sendMessage(STATUS_OK, "Scan starting");

      if (eeprom_scan(scanned_device_addresses) < 0)
      {
        sendMessage(STATUS_SCAN_NOTFOUND, "No i2c device found");
      }
      else
      {
        sendCommand(STATUS_SCAN_RESULT, scanned_device_addresses, sizeof(scanned_device_addresses));
      }
      break;

    default:
      sendMessage(STATUS_ERROR_COMMAND, "Invalid command received");
    }
  }

  delay(1000);
}

int dump(client_command *cmd) {
  Wire.setClock(cmd->frequency * 1000);

  sendMessage(STATUS_OK, "Dump starting");

  bool dumpHeaderSent = false;

  for (unsigned int i = cmd->start_byte; i <= cmd->end_byte; i++) {
    byte b;

    if (eeprom_read(cmd->i2c_address, i, &b) != 0) {
      sendMessage(STATUS_ERROR_DUMP, "Error dumping EEPROM content");
      return -1;
    } else {
      if(! dumpHeaderSent) {
        sendCommandHeader(STATUS_DUMP, cmd->end_byte - cmd->start_byte + 1);
        dumpHeaderSent = true;
      }

      Serial.write(b);
    }
  }

  Serial.flush();

  return 0;
}

int sendMessage(int status, const char *msg)
{
  return sendCommand(status, (byte *)msg, strlen(msg));
}

int sendCommand(int status, byte *buf, unsigned int length)
{
  int ret = 0;

  ret = sendCommandHeader(status, length);

  if (ret > 0)
  {
    ret = ret + Serial.write(buf, length);
  }

  Serial.flush();

  return ret;
}

int sendCommandHeader(int status, unsigned int length)
{
  int ret = 0;

  server_command cmd;

  cmd.status = ENDIAN(status);
  cmd.length = ENDIAN(length);

  ret = Serial.write((byte *)&cmd, sizeof(cmd));

  return ret;
}

int readCommand(client_command *cmd)
{
  int ret = -1;
  char message[128];

  memset(message, 0, sizeof(message));

  if (Serial.available() >= sizeof(client_command))
  {
    if (Serial.readBytes((byte *)cmd, sizeof(client_command)) == sizeof(client_command))
    {

      cmd->frequency = ENDIAN(cmd->frequency);
      cmd->start_byte = ENDIAN(cmd->start_byte);
      cmd->end_byte = ENDIAN(cmd->end_byte);

      // If frequency is zero then set to 100kHz
      if (cmd->frequency == 0)
      {
        cmd->frequency = 100;
      }

      ret = 0;

      if(snprintf(message, sizeof(message), "ARDUINO: Received command %d, frequency: %d, start: %d, end: %d", cmd->command, cmd->frequency, cmd->start_byte, cmd->end_byte) > 0) {
        sendMessage(STATUS_LOG, message);
      }
    }
  }

  return ret;
}

int eeprom_scan(byte devices[])
{
  int ret = -1;

  for (int i2c_address = 0; i2c_address < MAX_I2C_ADDRESS; i2c_address++)
  {

    Wire.beginTransmission(i2c_address);

    if (Wire.endTransmission() == 0)
    {
      devices[i2c_address] = '1';
      ret = 0;
    }
    else
    {
      devices[i2c_address] = '0';
    }
  }

  return ret;
}

int eeprom_read(int device_address, long block, byte *b)
{
  int ret = -1;

  Wire.beginTransmission(device_address);
  Wire.write((unsigned int)block);
  Wire.endTransmission();

  Wire.requestFrom(device_address, 1);

  if (Wire.available()) {
    *b = Wire.read();
    ret = 0;
  }

  return ret;
}
