#include <Arduino.h>

// The browser locates this 16-byte marker in the compiled .bin, then patches
// cycleMs and samples before sending the firmware through USB DFU.
struct __attribute__((packed, aligned(4))) CurveConfig {
  char marker[16];
  uint32_t cycleMs;
  uint8_t outputMode;  // 0 = LED_BUILTIN software PWM, 1 = hardware PWM.
  uint8_t outputPin;
  uint8_t reserved[2];
  uint8_t samples[64];
};

// volatile: the browser patches these bytes in the .bin after compilation,
// so the compiler must never constant-fold the initializer values.
__attribute__((used))
const volatile CurveConfig CURVE_CONFIG = {
  { 'L', 'E', 'D', 'C', 'R', 'V', '-', 'N',
    'A', 'N', 'O', 'R', '4', '-', 'V', '1' },
  3000,
  0,
  9,
  { 0, 0 },
  {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  }
};

const uint16_t PWM_PERIOD_US = 2000;  // 500 Hz software PWM.

uint8_t brightnessAt(uint32_t elapsedMs) {
  const uint32_t cycleMs =
      (CURVE_CONFIG.cycleMs >= 100 && CURVE_CONFIG.cycleMs <= 60000)
          ? CURVE_CONFIG.cycleMs
          : 3000;
  const uint32_t phase256 =
      ((elapsedMs % cycleMs) * 64UL * 256UL) / cycleMs;
  const uint8_t index = phase256 >> 8;
  const uint8_t next = (index + 1) & 0x3F;
  const uint8_t fraction = phase256 & 0xFF;
  const uint8_t a = CURVE_CONFIG.samples[index];
  const uint8_t b = CURVE_CONFIG.samples[next];
  return (uint8_t)((int16_t)a + ((int16_t)(b - a) * fraction) / 256);
}

void setup() {
  const uint8_t pin = CURVE_CONFIG.outputMode
      ? CURVE_CONFIG.outputPin
      : LED_BUILTIN;
  pinMode(pin, OUTPUT);
  digitalWrite(pin, LOW);
}

void loop() {
  const uint8_t level = brightnessAt(millis());
  if (CURVE_CONFIG.outputMode) {
    analogWrite(CURVE_CONFIG.outputPin, level);
    return;
  }

  const uint32_t nowUs = micros();
  static uint32_t pwmStartedUs = nowUs;

  const uint32_t elapsedUs = nowUs - pwmStartedUs;
  if (elapsedUs >= PWM_PERIOD_US) {
    pwmStartedUs += (elapsedUs / PWM_PERIOD_US) * PWM_PERIOD_US;
  }

  const uint16_t onTimeUs =
      ((uint32_t)level * PWM_PERIOD_US + 127) / 255;
  digitalWrite(
      LED_BUILTIN,
      ((uint32_t)(nowUs - pwmStartedUs) < onTimeUs) ? HIGH : LOW
  );
}
